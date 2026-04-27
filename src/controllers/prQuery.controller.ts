import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../config/db'
import { PrQueryStatus } from '@prisma/client'
import { z } from 'zod'
import { buildApprovalEmail, buildRejectionEmail } from '../utils/prQueryEmailTemplates'

// ─── Validation schemas ───────────────────────────────────────────────────────

const createPrQuerySchema = z.object({
    participantName:  z.string().min(1, 'Participant name is required'),
    participantEmail: z.email({ message: 'Invalid participant email' }),
    rollNumber:       z.string().optional(),
    participantId:    z.string().optional(),
    competitionName:  z.string().min(1, 'Competition name is required'),
    message:          z.string().min(1, 'Message is required'),
})

const updateStatusSchema = z.object({
    status:       z.nativeEnum(PrQueryStatus),
    resolvedNote: z.string().optional(),
})

// ─── GET /pr-queries ──────────────────────────────────────────────────────────
// Returns all queries, optionally filtered by status.
// Query params: status (PENDING | APPROVED | REJECTED), page, limit

export async function listPrQueries(req: AuthRequest, res: Response): Promise<void> {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const skip  = (page - 1) * limit

    const statusParam = (req.query.status as string)?.trim() || undefined

    const where: { status?: PrQueryStatus } = {}
    if (statusParam && Object.values(PrQueryStatus).includes(statusParam as PrQueryStatus)) {
        where.status = statusParam as PrQueryStatus
    }

    const [total, queries] = await Promise.all([
        prisma.prQuery.count({ where }),
        prisma.prQuery.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: {
                id:               true,
                participantName:  true,
                participantEmail: true,
                rollNumber:       true,
                participantId:    true,
                competitionName:  true,
                message:          true,
                status:           true,
                resolvedNote:     true,
                createdAt:        true,
                updatedAt:        true,
                createdBy: {
                    select: { id: true, email: true },
                },
            },
        }),
    ])

    res.json({
        success: true,
        data: queries,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    })
}

// ─── POST /pr-queries ─────────────────────────────────────────────────────────
// Creates a new query. Status defaults to PENDING.

export async function createPrQuery(req: AuthRequest, res: Response): Promise<void> {
    if (!req.userId) {
        res.status(401).json({ success: false, message: 'Authentication required.' })
        return
    }

    const parsed = createPrQuerySchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const {
        participantName,
        participantEmail,
        rollNumber,
        participantId,
        competitionName,
        message,
    } = parsed.data

    // If a participantId was supplied, verify it actually exists
    if (participantId) {
        const exists = await prisma.participant.findUnique({
            where: { id: participantId },
            select: { id: true },
        })
        if (!exists) {
            res.status(400).json({ success: false, message: 'Participant ID not found.' })
            return
        }
    }

    const query = await prisma.prQuery.create({
        data: {
            participantName,
            participantEmail,
            rollNumber:      rollNumber || null,
            participantId:   participantId || null,
            competitionName,
            message,
            status:          PrQueryStatus.PENDING,
            createdByUserId: req.userId,
        },
        select: {
            id:               true,
            participantName:  true,
            participantEmail: true,
            rollNumber:       true,
            participantId:    true,
            competitionName:  true,
            message:          true,
            status:           true,
            resolvedNote:     true,
            createdAt:        true,
        },
    })

    res.status(201).json({ success: true, data: query })
}

// ─── PATCH /pr-queries/:id/status ────────────────────────────────────────────
// Updates the status. On APPROVED or REJECTED, enqueues a PrQueryEmailQueue record
// for the future email worker to pick up (isSent = false).

export async function updatePrQueryStatus(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    const parsed = updateStatusSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const { status, resolvedNote } = parsed.data

    const existing = await prisma.prQuery.findUnique({
        where: { id },
        select: {
            id:               true,
            status:           true,
            participantEmail: true,
            participantName:  true,
            competitionName:  true,
        },
    })

    if (!existing) {
        res.status(404).json({ success: false, message: 'PR query not found.' })
        return
    }

    const updated = await prisma.prQuery.update({
        where: { id },
        data: {
            status,
            resolvedNote: resolvedNote ?? null,
            updatedAt:    new Date(),
        },
        select: {
            id:               true,
            participantName:  true,
            participantEmail: true,
            rollNumber:       true,
            competitionName:  true,
            message:          true,
            status:           true,
            resolvedNote:     true,
            updatedAt:        true,
        },
    })

    // ─── Email queue ──────────────────────────────────────────────────────────
    // Build the rendered email (subject + htmlBody) from the appropriate template
    // and insert a self-contained record into PrQueryEmailQueue.
    // The future email worker reads rows where isSent = false, sends the email,
    // and flips isSent = true — no extra rendering needed at send time.
    if (status === PrQueryStatus.APPROVED || status === PrQueryStatus.REJECTED) {
        const templateFn = status === PrQueryStatus.APPROVED
            ? buildApprovalEmail
            : buildRejectionEmail

        const { subject, htmlBody } = templateFn({
            participantName:  updated.participantName,
            participantEmail: updated.participantEmail,
            rollNumber:       updated.rollNumber ?? null,
            competitionName:  updated.competitionName,
            resolvedNote:     resolvedNote ?? null,
        })

        await prisma.prQueryEmailQueue.create({
            data: {
                prQueryId:       id,
                emailType:       status,            // 'APPROVED' | 'REJECTED'
                toEmail:         updated.participantEmail,
                subject,
                htmlBody,
                participantName: updated.participantName,
                competitionName: updated.competitionName,
                resolvedNote:    resolvedNote ?? null,
            },
        })
    }
    // ─────────────────────────────────────────────────────────────────────────

    res.json({ success: true, data: updated })
}

// ─── DELETE /pr-queries/:id ───────────────────────────────────────────────────
// Soft-hard delete (permanent). Only allowed on PENDING queries as a safety guard.

export async function deletePrQuery(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    const existing = await prisma.prQuery.findUnique({
        where: { id },
        select: { id: true, status: true },
    })

    if (!existing) {
        res.status(404).json({ success: false, message: 'PR query not found.' })
        return
    }

    await prisma.prQuery.delete({ where: { id } })

    res.json({ success: true, message: 'PR query deleted.' })
}
