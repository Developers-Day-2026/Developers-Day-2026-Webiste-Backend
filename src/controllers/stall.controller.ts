import { Prisma, RegistrationStatus } from '@prisma/client'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../config/db'

function toStallDto(stall: {
    id: string
    userId: string
    stallName: string
    menuDetails: string | null
    paymentStatus: RegistrationStatus
    stallLocation: string | null
    createdAt: Date
    updatedAt: Date
    user: { email: string; isActive: boolean }
}) {
    return {
        id: stall.id,
        userId: stall.userId,
        stallName: stall.stallName,
        menuDetails: stall.menuDetails,
        paymentStatus: stall.paymentStatus,
        stallLocation: stall.stallLocation,
        userEmail: stall.user.email,
        userIsActive: stall.user.isActive,
        createdAt: stall.createdAt.toISOString(),
        updatedAt: stall.updatedAt.toISOString(),
    }
}

// GET /stalls
export async function listStalls(req: AuthRequest, res: Response): Promise<void> {
    const page = Math.max(Number(req.query.page ?? 1) || 1, 1)
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 20) || 20, 1), 100)
    const q = String(req.query.q ?? '').trim()
    const userId = String(req.query.userId ?? '').trim()
    const paymentStatusRaw = String(req.query.paymentStatus ?? '').trim().toUpperCase()
    const userIsActiveRaw = String(req.query.userIsActive ?? '').trim().toLowerCase()

    const where: Prisma.FoodStallWhereInput = {}
    const and: Prisma.FoodStallWhereInput[] = []

    if (q) {
        and.push({
            OR: [
                { stallName: { contains: q, mode: 'insensitive' } },
                { menuDetails: { contains: q, mode: 'insensitive' } },
                { stallLocation: { contains: q, mode: 'insensitive' } },
                { user: { email: { contains: q, mode: 'insensitive' } } },
            ],
        })
    }

    if (userId) {
        and.push({ userId })
    }

    if (paymentStatusRaw) {
        const statuses = Object.values(RegistrationStatus)
        if (!statuses.includes(paymentStatusRaw as RegistrationStatus)) {
            res.status(400).json({
                success: false,
                message: `Invalid paymentStatus. Allowed: ${statuses.join(', ')}`,
            })
            return
        }
        and.push({ paymentStatus: paymentStatusRaw as RegistrationStatus })
    }

    if (userIsActiveRaw) {
        if (userIsActiveRaw !== 'true' && userIsActiveRaw !== 'false') {
            res.status(400).json({ success: false, message: 'userIsActive must be true or false.' })
            return
        }
        and.push({ user: { isActive: userIsActiveRaw === 'true' } })
    }

    if (and.length > 0) {
        where.AND = and
    }

    const [total, stalls] = await Promise.all([
        prisma.foodStall.count({ where }),
        prisma.foodStall.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: {
                user: { select: { email: true, isActive: true } },
            },
            orderBy: { stallName: 'asc' },
        }),
    ])

    const totalPages = Math.ceil(total / pageSize) || 1

    res.json({
        success: true,
        pagination: {
            page,
            pageSize,
            total,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
        filters: {
            q: q || null,
            userId: userId || null,
            paymentStatus: paymentStatusRaw || null,
            userIsActive: userIsActiveRaw || null,
        },
        data: stalls.map(toStallDto),
    })
}

// GET /stalls/:id
export async function getStallById(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    const stall = await prisma.foodStall.findUnique({
        where: { id },
        include: {
            user: { select: { email: true, isActive: true } },
        },
    })

    if (!stall) {
        res.status(404).json({ success: false, message: 'Stall not found.' })
        return
    }

    res.json({ success: true, data: toStallDto(stall) })
}

// POST /stalls
export async function createStall(req: AuthRequest, res: Response): Promise<void> {
    const {
        userId,
        stallName,
        menuDetails,
        paymentStatus,
        stallLocation,
    } = req.body as {
        userId: string
        stallName: string
        menuDetails?: string | null
        paymentStatus?: RegistrationStatus
        stallLocation?: string | null
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
        res.status(404).json({ success: false, message: 'User not found.' })
        return
    }

    try {
        const stall = await prisma.foodStall.create({
            data: {
                userId,
                stallName,
                menuDetails: menuDetails ?? null,
                paymentStatus: paymentStatus ?? RegistrationStatus.PENDING_PAYMENT,
                stallLocation: stallLocation ?? null,
            },
            include: {
                user: { select: { email: true, isActive: true } },
            },
        })

        res.status(201).json({
            success: true,
            message: 'Stall created successfully.',
            data: toStallDto(stall),
        })
    } catch (error: any) {
        if (error?.code === 'P2002') {
            res.status(409).json({ success: false, message: 'This user is already assigned to a stall.' })
            return
        }

        console.error('[createStall] error:', error)
        res.status(500).json({ success: false, message: 'Failed to create stall.' })
    }
}

// PATCH /stalls/:id
export async function updateStall(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)
    const {
        stallName,
        menuDetails,
        paymentStatus,
        stallLocation,
    } = req.body as {
        stallName?: string
        menuDetails?: string | null
        paymentStatus?: RegistrationStatus
        stallLocation?: string | null
    }

    try {
        const stall = await prisma.foodStall.update({
            where: { id },
            data: {
                stallName,
                menuDetails,
                paymentStatus,
                stallLocation,
            },
            include: {
                user: { select: { email: true, isActive: true } },
            },
        })

        res.json({
            success: true,
            message: 'Stall updated successfully.',
            data: toStallDto(stall),
        })
    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Stall not found.' })
            return
        }

        console.error('[updateStall] error:', error)
        res.status(500).json({ success: false, message: 'Failed to update stall.' })
    }
}

// DELETE /stalls/:id
export async function deleteStall(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    try {
        await prisma.foodStall.delete({ where: { id } })

        res.json({
            success: true,
            message: 'Stall deleted successfully.',
        })
    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Stall not found.' })
            return
        }

        console.error('[deleteStall] error:', error)
        res.status(500).json({ success: false, message: 'Failed to delete stall.' })
    }
}
