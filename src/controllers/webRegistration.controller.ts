import { Response } from 'express'
import { prisma } from '../config/db'
import { z } from 'zod'
import { RegistrationStatus } from '@prisma/client'
import { PaymentRequest } from '../middleware/uploadPaymentProof'

const publicMemberSchema = z.object({
    fullName:    z.string().min(1, 'Full name is required'),
    email:       z.string().email('Invalid email'),
    cnic:        z.string().min(13, 'CNIC must be at least 13 characters'),
    phone:       z.string().optional().default(''),
    institution: z.string().optional().default(''),
})

const publicRegistrationSchema = z.object({
    competitionId:    z.string().min(1, 'Competition ID is required'),
    teamName:         z.string().min(1, 'Team name is required'),
    referenceCode:    z.string().optional().default(''),
    leaderFullName:   z.string().min(1, 'Leader name is required'),
    leaderEmail:      z.string().email('Leader email is invalid'),
    leaderCnic:       z.string().min(13, 'Leader CNIC must be at least 13 characters'),
    leaderPhone:      z.string().optional().default(''),
    leaderInstitution:z.string().optional().default(''),
    members:          z.string().optional().default(''),
})

function parseMembers(raw: string | undefined): z.infer<typeof publicMemberSchema>[] {
    if (!raw) return []

    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []

        const validMembers: z.infer<typeof publicMemberSchema>[] = []

        for (const candidate of parsed) {
            const result = publicMemberSchema.safeParse(candidate)
            if (result.success) {
                validMembers.push(result.data)
            }
        }

        return validMembers
    } catch {
        return []
    }
}

function generateReferenceId(): string {
    const random = Math.random().toString(36).slice(2, 8).toUpperCase()
    const year = new Date().getFullYear()
    return `WEB-${year}-${random}`
}

export async function createPublicRegistration(req: PaymentRequest, res: Response): Promise<void> {
    const parsed = publicRegistrationSchema.safeParse(req.body)

    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const paymentProofUrl = req.paymentProofUrl

    if (!paymentProofUrl) {
        res.status(400).json({ success: false, message: 'Payment screenshot upload is missing.' })
        return
    }

    const {
        competitionId,
        teamName,
        referenceCode,
        leaderFullName,
        leaderEmail,
        leaderCnic,
        leaderPhone,
        leaderInstitution,
        members: membersRaw,
    } = parsed.data

    const extraMembers = parseMembers(membersRaw)

    const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true },
    })

    if (!competition) {
        res.status(404).json({ success: false, message: 'Competition not found.' })
        return
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const allMembers: z.infer<typeof publicMemberSchema>[] = [
                {
                    fullName:    leaderFullName,
                    email:       leaderEmail,
                    cnic:        leaderCnic,
                    phone:       leaderPhone,
                    institution: leaderInstitution,
                },
                ...extraMembers,
            ]

            const participantIds: { participantId: string; isLeader: boolean }[] = []

            for (let index = 0; index < allMembers.length; index++) {
                const m = allMembers[index]
                const isLeader = index === 0

                let participant = await tx.participant.findUnique({
                    where: { cnic: m.cnic },
                    include: { user: true },
                })

                if (participant) {
                    participant = await tx.participant.update({
                        where: { id: participant.id },
                        data: {
                            fullName:    m.fullName,
                            phone:       m.phone || null,
                            institution: m.institution || null,
                        },
                        include: { user: true },
                    })
                } else {
                    let user = await tx.user.findUnique({ where: { email: m.email } })

                    if (!user) {
                        user = await tx.user.create({
                            data: { email: m.email, type: 'PARTICIPANT' },
                        })
                    }

                    participant = await tx.participant.create({
                        data: {
                            userId:      user.id,
                            cnic:        m.cnic,
                            email:       m.email,
                            fullName:    m.fullName,
                            phone:       m.phone || null,
                            institution: m.institution || null,
                        },
                        include: { user: true },
                    })
                }

                participantIds.push({ participantId: participant.id, isLeader })
            }

            const referenceId = referenceCode || generateReferenceId()

            const team = await tx.team.create({
                data: {
                    name:            teamName,
                    competitionId,
                    referenceId,
                    paymentStatus:   RegistrationStatus.PENDING_PAYMENT,
                    paymentProofUrl: paymentProofUrl,
                    members: {
                        create: participantIds.map((p) => ({
                            participantId: p.participantId,
                            isLeader:      p.isLeader,
                        })),
                    },
                },
                include: {
                    competition: { select: { name: true, fee: true } },
                    _count:      { select: { members: true } },
                },
            })

            return team
        })

        res.status(201).json({
            success: true,
            data: {
                id:            result.id,
                teamName:      result.name,
                referenceId:   result.referenceId,
                paymentStatus: result.paymentStatus,
                paymentProofUrl,
                competition:   {
                    id:   result.competitionId,
                    name: result.competition.name,
                    fee:  result.competition.fee,
                },
                memberCount:   result._count.members,
            },
        })
    } catch (error) {
        console.error('[createPublicRegistration] Failed to create registration:', error)
        res.status(500).json({ success: false, message: 'Failed to create registration.' })
    }
}

