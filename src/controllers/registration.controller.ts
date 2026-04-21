import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { prisma } from '../config/db'
import { Prisma, RegistrationStatus, PaymentMethod, AttendanceMethod } from '@prisma/client'
import { z } from 'zod'
import { cacheGet, cacheSet, cacheDelete, cacheDeletePrefix } from '../utils/dataCache'

// Cache TTLs
const TTL_COMPETITIONS  = 5 * 60 * 1000   // 5 min  — competition list changes rarely
const TTL_DASHBOARD     = 30 * 1000        // 30 sec — live-ish aggregate stats
const TTL_REG_LIST      = 30 * 1000        // 30 sec — paged registration list
const TTL_REG_DETAIL    = 60 * 1000        // 60 sec — single registration detail


function normalizeCnic(value: string): string {
    return value.replace(/\D/g, '')
}


// GET /registrations/competitions 

export async function listCompetitions(_req: AuthRequest, res: Response): Promise<void> {
    const cached = cacheGet<unknown[]>('reg:competitions')
    if (cached) {
        res.json({ success: true, data: cached })
        return
    }
    const competitions = await prisma.competition.findMany({
        select: { id: true, name: true, compDay: true, minTeamSize: true, maxTeamSize: true },
        orderBy: { name: 'asc' },
    })
    cacheSet('reg:competitions', competitions, TTL_COMPETITIONS)
    res.json({ success: true, data: competitions })
}

//  GET /registrations 
// Query params: page, limit, search (name/referenceId/email), competitionId, status

export async function listRegistrations(req: AuthRequest, res: Response): Promise<void> {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const skip  = (page - 1) * limit

    const search        = (req.query.search        as string)?.trim() ?? ''
    const competitionId = (req.query.competitionId as string)?.trim() || undefined
    const statusParam   = (req.query.status        as string)?.trim() || undefined

    // ── Cache lookup (keyed by all query params) ────────────────────────────
    const cacheKey = `reg:list:${page}:${limit}:${search}:${competitionId ?? ''}:${statusParam ?? ''}`
    const cached = cacheGet<{ data: unknown[]; meta: unknown }>(cacheKey)
    if (cached) {
        res.json({ success: true, ...cached })
        return
    }

    // Build where clause
    const where: Prisma.TeamWhereInput = {}

    if (search) {
        where.OR = [
            { name:        { contains: search, mode: 'insensitive' } },
            { referenceId: { contains: search, mode: 'insensitive' } },
        ]
    }

    if (competitionId) {
        where.competitionId = competitionId
    }

    if (statusParam && Object.values(RegistrationStatus).includes(statusParam as RegistrationStatus)) {
        where.paymentStatus = statusParam as RegistrationStatus
    }

    const [total, teams] = await Promise.all([
        prisma.team.count({ where }),
        prisma.team.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                competition: { select: { id: true, name: true, compDay: true, fee: true } },
                _count:      { select: { members: true } },
            },
        }),
    ])

    const payload = {
        data: teams.map((t) => ({
            id:            t.id,
            name:          t.name,
            referenceId:   t.referenceId,
            paymentStatus: t.paymentStatus,
            paymentMethod: t.paymentMethod,
            competition:   t.competition,
            memberCount:   t._count.members,
            createdAt:     t.createdAt,
        })),
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        },
    }
    cacheSet(cacheKey, payload, TTL_REG_LIST)
    res.json({ success: true, ...payload })
} 

// GET /registrations/:id

export async function getRegistration(req: AuthRequest, res: Response): Promise<void> {
    const id = String(req.params.id)

    // ── Cache lookup ────────────────────────────────────────────────────────
    const cached = cacheGet<unknown>(`reg:detail:${id}`)
    if (cached) {
        res.json({ success: true, data: cached })
        return
    }

    // ── Single JOIN query — 1 connection, 1 round trip to Supabase ────────────
    // With connection_limit=1 on Vercel, Promise.all still serialises through
    // the single Prisma connection; a raw JOIN fetches everything at once.
    type Row = {
        id: string; name: string; reference_id: string
        payment_status: string; payment_method: string | null
        payment_date: Date | null; declared_tid: string | null
        amount_paid: string | null; payment_proof_url: string | null
        created_at: Date; updated_at: Date
        comp_id: string; comp_name: string; comp_day: number | null
        fee: string | null; min_team_size: number; max_team_size: number
        member_id: string | null; is_leader: boolean | null
        card_issued: boolean | null; card_issued_at: Date | null
        joined_at: Date | null; participant_id: string | null
        p_id: string | null; full_name: string | null
        p_email: string | null; cnic: string | null
        phone: string | null; institution: string | null
        att_status: boolean | null; att_method: string | null
        att_marked_at: Date | null
        note_rejection: string | null; note_on_hold: string | null
    }

    const rows = await prisma.$queryRaw<Row[]>`
        SELECT
          t.id, t.name, t."referenceId"       AS reference_id,
          t."paymentStatus"                   AS payment_status,
          t."paymentMethod"                   AS payment_method,
          t."paymentDate"                     AS payment_date,
          t."declaredTID"                     AS declared_tid,
          t."amountPaid"::text                AS amount_paid,
          t."paymentProofUrl"                 AS payment_proof_url,
          t."createdAt"                       AS created_at,
          t."updatedAt"                       AS updated_at,
          c.id                                AS comp_id,
          c.name                              AS comp_name,
          c."compDay"                         AS comp_day,
          c.fee::text                         AS fee,
          c."minTeamSize"                     AS min_team_size,
          c."maxTeamSize"                     AS max_team_size,
          tm.id                               AS member_id,
          tm."isLeader"                       AS is_leader,
          tm."cardIssued"                     AS card_issued,
          tm."cardIssuedAt"                   AS card_issued_at,
          tm."joinedAt"                       AS joined_at,
          tm."participantId"                  AS participant_id,
          p.id                                AS p_id,
          p."fullName"                        AS full_name,
          p.email                             AS p_email,
          p.cnic, p.phone, p.institution,
          ca.status                           AS att_status,
          ca.method                           AS att_method,
          ca."markedAt"                       AS att_marked_at,
          teq."noteRejection"                 AS note_rejection,
          teq."noteOnHold"                    AS note_on_hold
        FROM "Team" t
        JOIN  "Competition"          c   ON c.id              = t."competitionId"
        LEFT JOIN "TeamMember"       tm  ON tm."teamId"        = t.id
        LEFT JOIN "Participant"      p   ON p.id               = tm."participantId"
        LEFT JOIN "CompetitionAttendance" ca
                                         ON ca."teamId"        = t.id
                                        AND ca."participantId" = tm."participantId"
        LEFT JOIN "TeamEmailsQueue"  teq ON teq."teamMemberId" = tm.id
        WHERE t.id = ${id}
        ORDER BY tm."isLeader" DESC NULLS LAST
    `

    if (rows.length === 0) {
        res.status(404).json({ success: false, message: 'Registration not found.' })
        return
    }

    const r0 = rows[0]

    // First non-null note from any queue entry
    let note: string | null = null
    for (const r of rows) {
        const n = r.note_rejection || r.note_on_hold || null
        if (n) { note = n; break }
    }

    const detail = {
        id:              r0.id,
        name:            r0.name,
        referenceId:     r0.reference_id,
        paymentStatus:   r0.payment_status,
        paymentMethod:   r0.payment_method,
        paymentDate:     r0.payment_date,
        declaredTID:     r0.declared_tid,
        amountPaid:      r0.amount_paid,
        paymentProofUrl: r0.payment_proof_url,
        createdAt:       r0.created_at,
        updatedAt:       r0.updated_at,
        competition: {
            id:          r0.comp_id,
            name:        r0.comp_name,
            compDay:     r0.comp_day,
            fee:         r0.fee,
            minTeamSize: r0.min_team_size,
            maxTeamSize: r0.max_team_size,
        },
        note,
        members: rows
            .filter((r) => r.member_id !== null)
            .map((r) => ({
                id:           r.member_id!,
                isLeader:     r.is_leader,
                cardIssued:   r.card_issued,
                cardIssuedAt: r.card_issued_at,
                joinedAt:     r.joined_at,
                participant: {
                    id:          r.p_id,
                    fullName:    r.full_name,
                    email:       r.p_email,
                    cnic:        r.cnic,
                    phone:       r.phone,
                    institution: r.institution,
                },
                attendance: r.att_status !== null
                    ? { status: r.att_status, method: r.att_method, markedAt: r.att_marked_at }
                    : null,
            })),
    }

    cacheSet(`reg:detail:${id}`, detail, TTL_REG_DETAIL)
    res.json({ success: true, data: detail })
}

const paymentStatusUpdateSchema = z.object({
    status: z.nativeEnum(RegistrationStatus),
    note:   z.string().optional(),
})

export async function updateTeamPaymentStatus(req: AuthRequest, res: Response): Promise<void> {
    const teamId = String(req.params.teamId)

    const parsed = paymentStatusUpdateSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const { status, note } = parsed.data

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: { select: { id: true } } },
    })
    if (!team) {
        res.status(404).json({ success: false, message: 'Registration not found.' })
        return
    }

    await prisma.$transaction(async (tx) => {
        await tx.team.update({
            where: { id: teamId },
            data: { paymentStatus: status },
        })

        const teamMemberIds = team.members.map((m) => m.id)
        if (teamMemberIds.length > 0) {
            await tx.teamEmailsQueue.updateMany({
                where: { teamMemberId: { in: teamMemberIds } },
                data: {
                    sendRejection: status === 'REJECTED',
                    sendOnHold: status === 'ONHOLD',
                    sendAccept: status === 'VERIFIED',
                    noteRejection: status === 'REJECTED' ? note : null,
                    noteOnHold: status === 'ONHOLD' ? note : null,
                    updatedAt: new Date(),
                },
            })
        }

    })

    // ── Invalidate stale caches ─────────────────────────────────────────────
    cacheDelete(`reg:detail:${teamId}`)
    cacheDeletePrefix('reg:list:')
    cacheDelete('reg:dashboard_stats')

    res.json({
        success: true,
        data: {
            id:            teamId,
            paymentStatus: status,
            note:          note || null,
        },
    })
}

//  GET /registrations/competitions-form

export async function listCompetitionsForForm(_req: AuthRequest, res: Response): Promise<void> {
    const cached = cacheGet<unknown[]>('reg:competitions_form')
    if (cached) {
        res.json({ success: true, data: cached })
        return
    }
    const competitions = await prisma.competition.findMany({
        select: {
            id: true, name: true, compDay: true, fee: true,
            earlyBirdFee: true, earlyBirdLimit: true,
            minTeamSize: true, maxTeamSize: true,
            startTime: true, endTime: true,
        },
        orderBy: { name: 'asc' },
    })
    cacheSet('reg:competitions_form', competitions, TTL_COMPETITIONS)
    res.json({ success: true, data: competitions })
}

// POST /registrations/check-clashes

const clashSchema = z.object({
    competitionId: z.string().min(1, 'Competition ID is required'),
    cnics: z.array(z.string().min(1)).min(1),
})

export async function checkClashes(req: AuthRequest, res: Response): Promise<void> {
    const parsed = clashSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const { competitionId, cnics } = parsed.data

    // Get the target competition's timing
    const targetComp = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, name: true, startTime: true, endTime: true },
    })

    if (!targetComp) {
        res.status(404).json({ success: false, message: 'Competition not found.' })
        return
    }

    // Find participants by CNIC
    const participants = await prisma.participant.findMany({
        where: { cnic: { in: cnics } },
        select: { id: true, cnic: true, fullName: true },
    })

    if (participants.length === 0) {
        // No existing participants means no clashes possible
        res.json({ success: true, clashes: [] })
        return
    }

    // Find team memberships for those participants where the competition time overlaps
    const clashes = await prisma.teamMember.findMany({
        where: {
            participantId: { in: participants.map((p) => p.id) },
            team: {
                competition: {
                    id: { not: competitionId },
                    startTime: { lt: targetComp.endTime },
                    endTime:   { gt: targetComp.startTime },
                },
            },
        },
        select: {
            participant: { select: { fullName: true, cnic: true } },
            team: {
                select: {
                    name: true,
                    competition: { select: { name: true, startTime: true, endTime: true } },
                },
            },
        },
    })

    const formatted = clashes.map((c) => ({
        participantName: c.participant.fullName,
        participantCnic: c.participant.cnic,
        clashTeam:       c.team.name,
        clashCompetition: c.team.competition.name,
        clashStart:      c.team.competition.startTime,
        clashEnd:        c.team.competition.endTime,
    }))

    res.json({ success: true, clashes: formatted })
}

//  POST /registrations 

const memberSchema = z.object({
    fullName:    z.string().min(1, 'Full name is required'),
    email:       z.string().email('Invalid email'),
    cnic:        z.string().min(13, 'CNIC must be at least 13 characters'),
    phone:       z.string().optional().default(''),
    institution: z.string().optional().default(''),
    isLeader:    z.boolean(),
})

const createRegistrationSchema = z.object({
    teamName:      z.string().min(1, 'Team name is required'),
    competitionId: z.string().min(1, 'Competition ID is required'),
    referenceId:   z.string().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod),
    amountPaid:    z.string().min(1, 'Amount paid is required'),
    members:       z.array(memberSchema).min(1, 'At least one member is required'),
    isEarlyBird:   z.boolean().default(false)
})

export async function createRegistration(req: AuthRequest, res: Response): Promise<void> {
    const parsed = createRegistrationSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const { teamName, competitionId, referenceId, paymentMethod, amountPaid, members, isEarlyBird } = parsed.data


    const allCnics = [
        ...members.map((m) => normalizeCnic(m.cnic)),
    ]

    if (allCnics.length !== new Set(allCnics).size) {
        res.status(400).json({
            success: false,
            message: 'Duplicate CNIC in team members. Each participant must have a unique CNIC.',
        })
        return
    }

    const allEmails = [
        ...members.map((m) => m.email.trim().toLowerCase()),
    ]

    if (allEmails.length !== new Set(allEmails).size) {
        res.status(400).json({
            success: false,
            message: 'Duplicate email in team members. Each participant must have a unique email.',
        })
        return
    }


    // Validate competition exists
    const competition = await prisma.competition.findUnique({
        where: { id: competitionId },
        select: { id: true, minTeamSize: true, maxTeamSize: true, fee: true },
    })

    if (!competition) {
        res.status(404).json({ success: false, message: 'Competition not found.' })
        return
    }

    // Validate team size
    if (members.length < competition.minTeamSize || members.length > competition.maxTeamSize) {
        res.status(400).json({
            success: false,
            message: `Team must have between ${competition.minTeamSize} and ${competition.maxTeamSize} members.`,
        })
        return
    }

    // Validate exactly one leader
    const leaders = members.filter((m) => m.isLeader)
    if (leaders.length !== 1) {
        res.status(400).json({ success: false, message: 'Exactly one member must be the leader.' })
        return
    }

    const existingInCompetition = await prisma.teamMember.findMany({
        where: {
            team: { competitionId },
            OR: [
                { participant: { cnic: { in: allCnics } } },
                { participant: { email: { in: allEmails } } },
            ],
        },
        select: {
            participant: { select: { fullName: true, cnic: true, email: true } },
        },
    })

    if (existingInCompetition.length > 0) {
        const names = existingInCompetition.map((r) => r.participant.fullName).join(', ')
        res.status(409).json({
            success: false,
            message: `One or more team members are already registered for this competition: ${names}`,
        })
        return
    }
  

    // Upsert participants and build team in a transaction
    const result = await prisma.$transaction(async (tx) => {
        // Upsert each participant by CNIC
        const participantIds: { participantId: string; isLeader: boolean }[] = []

        for (const m of members) {
            // Look up an existing participant by CNIC first (stable identifier)
            let participant = await tx.participant.findUnique({
                where: { cnic: m.cnic },
                include: { user: true },
            })

            if (participant) {
                // Participant already exists — update their details
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
                // No participant with this CNIC — check if a User with this email already exists
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

            participantIds.push({ participantId: participant.id, isLeader: m.isLeader })
        }

        const asfandCode = 'asfand_code'
        const refToUse = referenceId?.trim() || asfandCode;

        let referenceCode = ''

        if (refToUse!== asfandCode) {
            const ba = await tx.brandAmbassador.findUnique({
                where: { referralCode: refToUse },
                select: { id: true },
            })

            if (!ba) {
                const err = new Error('BA_CODE_INVALID') as Error & { code: string }
                err.code = 'BA_CODE_INVALID'
                throw err
            }

            referenceCode = refToUse
        } else {
            referenceCode = asfandCode
        }

        const seatUpdate = isEarlyBird
            ? await tx.competition.updateMany({
                    where: { id: competitionId, earlyBirdLimit: { gt: 0 } },
                    data: { earlyBirdLimit: { decrement: 1 } },
                })
            : await tx.competition.updateMany({
                    where: { id: competitionId, capacityLimit: { gt: 0 } },
                    data: { capacityLimit: { decrement: 1 } },
                })

        if (seatUpdate.count !== 1) {
            const err = new Error(isEarlyBird ? 'EARLY_BIRD_FULL' : 'CAPACITY_FULL') as Error & { code: string }
            err.code = isEarlyBird ? 'EARLY_BIRD_FULL' : 'CAPACITY_FULL'
            throw err
        }

        // Create team
        const team = await tx.team.create({
            data: {
                name:          teamName,
                competitionId,
                referenceId: referenceCode,
                paymentStatus: 'VERIFIED',
                paymentMethod,
                isEarlyBird,
                amountPaid:    parseFloat(amountPaid),
                paymentDate:   new Date(),
                members: {
                    create: participantIds.map((p) => ({
                        participantId: p.participantId,
                        isLeader:      p.isLeader,
                    })),
                },
            },
            include: {
                competition: { select: { name: true } },
                _count:      { select: { members: true } },
            },
        })

        return team
    })

    // Invalidate list + dashboard stats; competition capacity changed too
    cacheDeletePrefix('reg:list:')
    cacheDelete('reg:dashboard_stats')
    cacheDelete('reg:competitions')
    cacheDelete('reg:competitions_form')
    cacheDelete('comp:list')
    cacheDelete('comp:public')

    res.status(201).json({
        success: true,
        data: {
            id:          result.id,
            name:        result.name,
            referenceId: result.referenceId,
            competition: result.competition.name,
            memberCount: result._count.members,
        },
    })
}

//  GET /registrations/search?q=<query>

export async function searchTeams(req: AuthRequest, res: Response): Promise<void> {
    const query = (req.query.q as string)?.trim() ?? ''

    // Search by team ID, team name, or leader name
    const teams = await prisma.team.findMany({
        where: {
            OR: [
                { id:          { contains: query, mode: 'insensitive' } },
                { name:        { contains: query, mode: 'insensitive' } },
                { referenceId: { contains: query, mode: 'insensitive' } },
                {
                    members: {
                        some: {
                            isLeader: true,
                            participant: {
                                fullName: { contains: query, mode: 'insensitive' },
                            },
                        },
                    },
                },
            ],
        },
        include: {
            competition: {
                select: { id: true, name: true, compDay: true },
            },
            members: {
                where: { isLeader: true },
                include: {
                    participant: {
                        select: { fullName: true, email: true },
                    },
                },
                take: 1,
            },
            attendance: {
                select: { participantId: true, status: true },
            },
            _count: { select: { members: true } },
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
    })

    res.json({
        success: true,
        data: teams.map((t) => {
            const totalMembers   = t._count.members
            const markedPresent  = t.attendance.filter((a) => a.status).length
            const attendanceMarked = totalMembers > 0 && markedPresent === totalMembers
            return {
                id:               t.id,
                name:             t.name,
                referenceId:      t.referenceId,
                competition:      t.competition,
                leader:           t.members[0]?.participant || null,
                memberCount:      totalMembers,
                attendanceMarked,
                markedCount:      markedPresent,
            }
        }),
    })
}

// GET /registrations/search-members?query=<query>

export async function searchTeamMembers(req: AuthRequest, res: Response): Promise<void> {
    const query = (req.query.query as string)?.trim() ?? ''

    if (!query) {
        res.json({ success: true, data: [] })
        return
    }

    // Find all participants matching the search query
    const participants = await prisma.participant.findMany({
        where: {
            OR: [
                { fullName: { contains: query, mode: 'insensitive' } },
                { email:    { contains: query, mode: 'insensitive' } },
                { cnic:     { contains: query, mode: 'insensitive' } },
            ],
        },
        include: {
            teamMembers: {
                include: {
                    team: {
                        include: {
                            competition: {
                                select: { id: true, name: true },
                            },
                        },
                    },
                },
            },
        },
        take: 50,
    })

    // Group by participant and collect competitions
    const results = participants.map((participant) => ({
        participant: {
            id: participant.id,
            fullName: participant.fullName,
            email: participant.email,
            cnic: participant.cnic,
        },
        competitions: participant.teamMembers.map((tm) => tm.team.competition),
    }))

    res.json({ success: true, data: results })
}

//  POST /registrations/:teamId/mark-attendance

const markAttendanceSchema = z.object({
    method: z.nativeEnum(AttendanceMethod),
    notes:  z.string().optional(),
})

export async function markTeamAttendance(req: AuthRequest, res: Response): Promise<void> {
    const teamId = String(req.params.teamId)

    const parsed = markAttendanceSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const { method, notes } = parsed.data

    // Verify team exists
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
            members: { select: { participantId: true } },
        },
    })

    if (!team) {
        res.status(404).json({ success: false, message: 'Team not found.' })
        return
    }

    if (team.members.length === 0) {
        res.status(400).json({ success: false, message: 'Team has no members.' })
        return
    }

    // Get the staff user ID from the request
    const markedByUserId = req.userId || null

    // Mark attendance for all team members
    const result = await prisma.$transaction(async (tx) => {
        // Upsert attendance for each team member
        const attendanceRecords = await Promise.all(
            team.members.map((m) =>
                tx.competitionAttendance.upsert({
                    where: {
                        teamId_participantId: {
                            teamId,
                            participantId: m.participantId,
                        },
                    },
                    update: {
                        status:         true,
                        method,
                        markedByUserId,
                        markedAt:       new Date(),
                        notes:          notes || null,
                    },
                    create: {
                        teamId,
                        participantId:  m.participantId,
                        status:         true,
                        method,
                        markedByUserId,
                        markedAt:       new Date(),
                        notes:          notes || null,
                    },
                })
            )
        )

        return attendanceRecords
    })

    // Invalidate the cached registration detail so attendance is reflected
    cacheDelete(`reg:detail:${teamId}`)
    cacheDelete('reg:dashboard_stats')

    res.json({
        success: true,
        message: `Attendance marked for ${result.length} team member(s).`,
        data: { markedCount: result.length },
    })
}

// PATCH /registrations/:teamId/change-competition

const changeCompetitionSchema = z.object({
    newCompetitionId: z.string().min(1, 'New competition ID is required'),
    force:            z.boolean().optional().default(false),
})

export async function changeTeamCompetition(req: AuthRequest, res: Response): Promise<void> {
    const teamId = String(req.params.teamId)

    const parsed = changeCompetitionSchema.safeParse(req.body)
    if (!parsed.success) {
        res.status(400).json({ success: false, errors: parsed.error.issues })
        return
    }

    const { newCompetitionId, force } = parsed.data

    // Load team with all members and current competition
    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
            competition: { select: { id: true, name: true, startTime: true, endTime: true } },
            members: {
                select: {
                    participantId: true,
                    participant:   { select: { fullName: true, cnic: true } },
                },
            },
        },
    })

    if (!team) {
        res.status(404).json({ success: false, message: 'Team not found.' })
        return
    }

    if (team.competitionId === newCompetitionId) {
        res.status(400).json({ success: false, message: 'Team is already in this competition.' })
        return
    }

    // Validate new competition
    const newComp = await prisma.competition.findUnique({
        where: { id: newCompetitionId },
        select: { id: true, name: true, startTime: true, endTime: true, minTeamSize: true, maxTeamSize: true },
    })

    if (!newComp) {
        res.status(404).json({ success: false, message: 'Target competition not found.' })
        return
    }

    // Validate team size against new competition constraints
    const memberCount = team.members.length
    if (memberCount < newComp.minTeamSize || memberCount > newComp.maxTeamSize) {
        res.status(400).json({
            success: false,
            message: `Team has ${memberCount} member(s), but "${newComp.name}" requires ${newComp.minTeamSize}–${newComp.maxTeamSize}.`,
        })
        return
    }

    // Check for timing clashes for every team member against their OTHER registrations
    // (exclude the current team being moved, since they are leaving that competition)
    if (!force) {
        const participantIds = team.members.map((m) => m.participantId)

        const clashingMembers = await prisma.teamMember.findMany({
            where: {
                participantId: { in: participantIds },
                team: {
                    id:  { not: teamId }, // exclude the current team
                    competition: {
                        id:        { not: newCompetitionId },
                        startTime: { lt: newComp.endTime },
                        endTime:   { gt: newComp.startTime },
                    },
                },
            },
            select: {
                participant: { select: { fullName: true, cnic: true } },
                team: {
                    select: {
                        name:        true,
                        competition: { select: { name: true, startTime: true, endTime: true } },
                    },
                },
            },
        })

        if (clashingMembers.length > 0) {
            res.status(409).json({
                success: false,
                clashes: clashingMembers.map((c) => ({
                    participantName:  c.participant.fullName,
                    participantCnic:  c.participant.cnic,
                    clashTeam:        c.team.name,
                    clashCompetition: c.team.competition.name,
                    clashStart:       c.team.competition.startTime,
                    clashEnd:         c.team.competition.endTime,
                })),
            })
            return
        }
    }

    // Perform the competition change
    await prisma.team.update({
        where: { id: teamId },
        data:  { competitionId: newCompetitionId },
    })

    cacheDelete(`reg:detail:${teamId}`)
    cacheDeletePrefix('reg:list:')
    cacheDelete('reg:dashboard_stats')

    res.json({
        success: true,
        message: `Team moved to "${newComp.name}" successfully.`,
        data: { teamId, newCompetitionId, newCompetitionName: newComp.name },
    })
}

// GET /registrations/dashboard-stats

export async function getDashboardStats(_req: AuthRequest, res: Response): Promise<void> {
    const cached = cacheGet<unknown>('reg:dashboard_stats')
    if (cached) {
        res.json({ success: true, data: cached })
        return
    }

    // Get all stats in parallel
    const [
        totalRegistrations,
        verifiedPayments,
        pendingPayments,
        totalParticipants,
        attendedParticipants,
    ] = await Promise.all([
        // Total registrations (teams)
        prisma.team.count(),

        // Verified payments
        prisma.team.count({
            where: { paymentStatus: 'VERIFIED' },
        }),

        // Pending payments
        prisma.team.count({
            where: { paymentStatus: 'PENDING_PAYMENT' },
        }),

        // Total participants
        prisma.teamMember.count(),

        // Attended participants
        prisma.competitionAttendance.count({
            where: { status: true },
        }),
    ])

    // Calculate attendance percentage
    const attendancePercentage = totalParticipants > 0
        ? Math.round((attendedParticipants / totalParticipants) * 100)
        : 0

    const stats = {
        totalRegistrations,
        verifiedPayments,
        pendingPayments,
        attendancePercentage,
    }
    cacheSet('reg:dashboard_stats', stats, TTL_DASHBOARD)
    res.json({ success: true, data: stats })
}
