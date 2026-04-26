/**
 * emailQueueWorker.ts
 *
 * Cron job that runs every 2 minutes.
 * Reads PrQueryEmailQueue rows where isSent = false,
 * sends each email via Gmail SMTP (Nodemailer), then marks the row as sent.
 * Failed sends increment retryCount (max 3 attempts).
 */

import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { prisma } from '../config/db'

const SMTP_EMAIL    = process.env.SMTP_EMAIL || ''
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || ''
const MAX_RETRIES   = 3
const BATCH_SIZE    = 10   // process up to 10 emails per tick

// Create the transporter using Gmail settings
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: SMTP_EMAIL,
        pass: SMTP_PASSWORD,
    },
})

// ─── Core processor ───────────────────────────────────────────────────────────

async function processEmailQueue(): Promise<void> {
    // Grab the oldest unsent rows that haven't exceeded the retry limit
    const pending = await prisma.prQueryEmailQueue.findMany({
        where: {
            isSent:     false,
            retryCount: { lt: MAX_RETRIES },
        },
        orderBy: { createdAt: 'asc' },
        take:    BATCH_SIZE,
    })

    if (pending.length === 0) return   // nothing to do

    console.log(`[emailWorker]: Processing ${pending.length} pending email(s) via Gmail SMTP...`)

    for (const row of pending) {
        try {
            await transporter.sendMail({
                from:    `"Developers Day 2026" <${SMTP_EMAIL}>`,
                to:      row.toEmail,
                subject: row.subject,
                html:    row.htmlBody,
            })

            // ✅ Success — mark as sent
            await prisma.prQueryEmailQueue.update({
                where: { id: row.id },
                data: {
                    isSent:      true,
                    sentAt:      new Date(),
                    failedReason: null,
                },
            })

            console.log(`[emailWorker]: ✅ Sent to ${row.toEmail} (queryId: ${row.prQueryId})`)

        } catch (err: unknown) {
            const reason = err instanceof Error ? err.message : String(err)

            // ❌ Failure — increment retry counter
            await prisma.prQueryEmailQueue.update({
                where: { id: row.id },
                data: {
                    retryCount:   { increment: 1 },
                    failedReason: reason,
                },
            })

            console.error(`[emailWorker]: ❌ Failed for ${row.toEmail} (attempt ${row.retryCount + 1}/${MAX_RETRIES}): ${reason}`)
        }
    }
}

// ─── Cron schedule ────────────────────────────────────────────────────────────
// Runs every 1 minute.

export function startEmailQueueWorker(): void {
    cron.schedule('* * * * *', async () => {
        try {
            await processEmailQueue()
        } catch (err) {
            console.error('[emailWorker]: Unexpected error in cron tick:', err)
        }
    })

    console.log('[emailWorker]: Email queue worker started (Gmail SMTP routing)')
}
