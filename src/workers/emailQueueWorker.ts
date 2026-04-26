/**
 * emailQueueWorker.ts
 *
 * Cron job that runs every 2 minutes.
 * Reads PrQueryEmailQueue rows where isSent = false,
 * sends each email via Resend, then marks the row as sent.
 * Failed sends increment retryCount (max 3 attempts).
 */

import cron from 'node-cron'
import { Resend } from 'resend'
import { prisma } from '../config/db'

const resend      = new Resend(process.env.RESEND_API_KEY)
const FROM_EMAIL  = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
const MAX_RETRIES = 3
const BATCH_SIZE  = 10   // process up to 10 emails per tick

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

    console.log(`[emailWorker]: Processing ${pending.length} pending email(s)...`)

    for (const row of pending) {
        try {
            const { error } = await resend.emails.send({
                from:    FROM_EMAIL,
                to:      row.toEmail,
                subject: row.subject,
                html:    row.htmlBody,
            })

            if (error) throw new Error(error.message)

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
// Runs every 2 minutes.  Change '*/2 * * * *' to '* * * * *' for every minute.

export function startEmailQueueWorker(): void {
    cron.schedule('*/2 * * * *', async () => {
        try {
            await processEmailQueue()
        } catch (err) {
            console.error('[emailWorker]: Unexpected error in cron tick:', err)
        }
    })

    console.log('[emailWorker]: Email queue worker started (runs every 2 minutes)')
}
