import { PrismaClient, UserType, StaffRole, RegistrationStatus, AttendanceMethod, PaymentMethod, PointsLedgerEntryType, SubmissionStatus, Action } from '@prisma/client'
import bcryptjs from 'bcryptjs'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
})

// Helper functions
function generateId(prefix: string = ''): string {
    return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
}

function getRandomElements<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random())
    return shuffled.slice(0, Math.min(count, array.length))
}

function generateEmail(name: string, domain: string = 'example.com'): string {
    return `${name.toLowerCase().replace(/\s+/g, '.')}${Math.random().toString(36).substr(2, 5)}@${domain}`
}

function generatePhone(): string {
    return `+92${Math.floor(Math.random() * 9000000000).toString().padStart(10, '0')}`
}

function generateCNIC(): string {
    return Math.floor(Math.random() * 90000000000000).toString().padStart(13, '0')
}

function generateReferralCode(): string {
    return `REF${Math.random().toString(36).substr(2, 8).toUpperCase()}`
}

function generateMinigameCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

const institutions = [
    'FAST NUCES',
    'IBA Karachi',
    'Hamdard University',
    'Bahria University',
    'COMSATS',
    'UET Lahore',
    'NED University',
    'PIEAS',
]

const companies = [
    'TechCorp Solutions',
    'Digital Innovations',
    'Cloud Systems Inc',
    'Data Analytics Pro',
    'AI Technologies',
    'Web Services Ltd',
]

const categories = [
    'Technology',
    'Finance',
    'Healthcare',
    'E-commerce',
    'Education',
    'Consulting',
]

const competitionNames = [
    'Web Development Challenge',
    'Mobile App Hackathon',
    'AI & Machine Learning',
    'Data Science Competition',
    'Cloud Infrastructure',
    'Cybersecurity CTF',
    'IoT Innovation',
    'Blockchain Bootcamp',
]

async function main() {
    console.log('🌱 Starting comprehensive dummy data seed...\n')

    try {
        // ==================== ACTIVITY TYPES ====================
        console.log('📝 Seeding Activity Types...')
        const activityTypes = await Promise.all([
            prisma.activityType.upsert({
                where: { code: 'MANUAL' },
                create: { code: 'MANUAL', name: 'Manual Activity', description: 'Activity marked manually by staff' },
                update: {},
            }),
            prisma.activityType.upsert({
                where: { code: 'LINK_BASED' },
                create: { code: 'LINK_BASED', name: 'Link Based', description: 'Activity with submission link' },
                update: {},
            }),
            prisma.activityType.upsert({
                where: { code: 'CORRECT_ANSWER' },
                create: { code: 'CORRECT_ANSWER', name: 'Correct Answer', description: 'Activity with answer validation' },
                update: {},
            }),
            prisma.activityType.upsert({
                where: { code: 'MANUAL_TEXT_SUBMISSION' },
                create: { code: 'MANUAL_TEXT_SUBMISSION', name: 'Text Submission', description: 'Activity with text submission' },
                update: {},
            }),
        ])
        console.log(`   ✓ ${activityTypes.length} activity types created\n`)

        // ==================== CATEGORIES ====================
        console.log('🏷️  Seeding Categories...')
        const createdCategories = await Promise.all(
            categories.map(cat =>
                prisma.category.upsert({
                    where: { name: cat },
                    create: { name: cat, description: `${cat} category for companies` },
                    update: {},
                })
            )
        )
        console.log(`   ✓ ${createdCategories.length} categories created\n`)

        // ==================== MASTER CONFIG ====================
        console.log('⚙️  Seeding Master Config...')
        const masterConfig = await prisma.masterConfig.upsert({
            where: { key: 'EVENT_START_DATE' },
            create: { key: 'EVENT_START_DATE', valueText: '2026-03-15', description: 'DevDay 2026 start date' },
            update: {},
        })
        console.log(`   ✓ Master config created\n`)

        // ==================== VENUES ====================
        console.log('🏢 Seeding Venues...')
        const venues = await Promise.all(
            [
                { name: 'Main Hall A', location: 'Building 1, Floor 2', capacity: 500 },
                { name: 'Main Hall B', location: 'Building 1, Floor 3', capacity: 400 },
                { name: 'Seminar Room 1', location: 'Building 2, Floor 1', capacity: 100 },
                { name: 'Seminar Room 2', location: 'Building 2, Floor 2', capacity: 100 },
                { name: 'Workshop Area', location: 'Building 3, Ground Floor', capacity: 200 },
            ].map(async (v) => {
                const existing = await prisma.venue.findFirst({ where: { name: v.name } })
                return existing ?? prisma.venue.create({ data: v })
            })
        )
        console.log(`   ✓ ${venues.length} venues created\n`)

        // ==================== COMPETITIONS ====================
        console.log('🎮 Seeding Competitions...')
        const competitions = await Promise.all(
            competitionNames.map((name, idx) => {
                const day = new Date('2026-03-15')
                const hour = 9 + idx
                const startTime = new Date(`2026-03-15T${String(hour).padStart(2, '0')}:00:00`)
                const endTime = new Date(startTime.getTime() + 3 * 60 * 60 * 1000)

                return prisma.competition.upsert({
                    where: { id: `comp-${idx}` },
                    create: {
                        id: `comp-${idx}`,
                        name,
                        description: `This is a ${name} competition where participants showcase their skills`,
                        fee: 1000 + idx * 500,
                        earlyBirdFee: 500 + idx * 300,
                        earlyBirdLimit: 50,
                        minTeamSize: 1,
                        maxTeamSize: 5,
                        capacityLimit: 200,
                        totalSeats: 200,
                        compDay: day,
                        startTime,
                        endTime,
                        registrationDeadline: new Date('2026-03-10T23:59:00'),
                        category: getRandomElement(['Technical', 'Creative', 'Business']),
                    },
                    update: {},
                })
            })
        )
        console.log(`   ✓ ${competitions.length} competitions created\n`)

        // ==================== COMPETITION CONFIGS ====================
        console.log('📋 Seeding Competition Configs...')
        const compConfigs = await Promise.all(
            competitions.slice(0, 3).flatMap(comp => [
                prisma.competitionConfig.upsert({
                    where: { competitionId_key: { competitionId: comp.id, key: 'RULES' } },
                    create: { competitionId: comp.id, key: 'RULES', valueText: 'Standard competition rules apply' },
                    update: {},
                }),
                prisma.competitionConfig.upsert({
                    where: { competitionId_key: { competitionId: comp.id, key: 'DIFFICULTY' } },
                    create: { competitionId: comp.id, key: 'DIFFICULTY', valueText: 'INTERMEDIATE' },
                    update: {},
                }),
            ])
        )
        console.log(`   ✓ ${compConfigs.length} competition configs created\n`)

        // ==================== USERS (Participants) ====================
        console.log('👥 Seeding Participant Users...')
        const participantUsers = await Promise.all(
            Array.from({ length: 20 }).map((_, i) => {
                const firstName = ['Ahmed', 'Fatima', 'Hassan', 'Aisha', 'Ali', 'Sara', 'Muhammad', 'Zainab'][i % 8]
                const lastName = ['Khan', 'Ahmed', 'Hassan', 'Ali', 'Malik', 'Hussain', 'Raza', 'Noor'][i % 8]
                const email = generateEmail(`${firstName}.${lastName}${i}`)
                const password = bcryptjs.hashSync('password123', 10)

                return prisma.user.upsert({
                    where: { email },
                    create: {
                        email,
                        password,
                        type: UserType.PARTICIPANT,
                        isActive: true,
                    },
                    update: {},
                })
            })
        )
        console.log(`   ✓ ${participantUsers.length} participant users created\n`)

        // ==================== PARTICIPANTS ====================
        console.log('📋 Seeding Participants...')
        const participants = await Promise.all(
            participantUsers.map((user, i) => {
                const firstName = ['Ahmed', 'Fatima', 'Hassan', 'Aisha', 'Ali', 'Sara', 'Muhammad', 'Zainab'][i % 8]
                const lastName = ['Khan', 'Ahmed', 'Hassan', 'Ali', 'Malik', 'Hussain', 'Raza', 'Noor'][i % 8]

                return prisma.participant.upsert({
                    where: { userId: user.id },
                    create: {
                        userId: user.id,
                        email: user.email,
                        fullName: `${firstName} ${lastName}`,
                        cnic: generateCNIC(),
                        phone: generatePhone(),
                        institution: getRandomElement(institutions),
                        rollNumber: `NU-${1000 + i}`,
                        minigameCode: generateMinigameCode(),
                    },
                    update: {},
                })
            })
        )
        console.log(`   ✓ ${participants.length} participants created\n`)

        // ==================== STAFF USERS ====================
        console.log('👨‍💼 Seeding Staff Users...')
        const staffUsers = await Promise.all(
            Array.from({ length: 10 }).map((_, i) => {
                const staffRoles = Object.values(StaffRole)
                const email = generateEmail(`staff${i}`)
                const password = bcryptjs.hashSync('staff123', 10)

                return prisma.user.upsert({
                    where: { email },
                    create: {
                        email,
                        password,
                        type: UserType.STAFF,
                        isActive: true,
                    },
                    update: {},
                })
            })
        )
        console.log(`   ✓ ${staffUsers.length} staff users created\n`)

        // ==================== STAFF PROFILES ====================
        console.log('🎖️  Seeding Staff Profiles...')
        const staffProfiles = await Promise.all(
            staffUsers.map((user, i) => {
                const staffRoles = Object.values(StaffRole)
                const role = staffRoles[i % staffRoles.length]

                return prisma.staffProfile.upsert({
                    where: { id: user.id },
                    create: {
                        id: user.id,
                        fullName: `Staff Member ${i + 1}`,
                        nuId: `NU${1000 + i}`,
                        staffRole: role,
                        isApproved: true,
                        approvedAt: new Date(),
                        assignedBooth: `Booth-${i}`,
                    },
                    update: {},
                })
            })
        )
        console.log(`   ✓ ${staffProfiles.length} staff profiles created\n`)

        // ==================== ACTIVITIES ====================
        console.log('🎯 Seeding Activities...')
        const activities = await Promise.all(
            Array.from({ length: 15 }).map((_, i) => {
                const type = activityTypes[i % activityTypes.length]

                return prisma.activity.upsert({
                    where: { code: `ACTIVITY_${i}` },
                    create: {
                        code: `ACTIVITY_${i}`,
                        name: `Activity ${i + 1}`,
                        description: `Description for activity ${i + 1}`,
                        points: 10 + i * 5,
                        activityTypeId: type.id,
                        correctAnswerCanonical: type.code === 'CORRECT_ANSWER' ? `correct_${i}` : null,
                        isActive: true,
                        createdByStaffProfileId: staffProfiles[0].id,
                    },
                    update: {},
                })
            })
        )
        console.log(`   ✓ ${activities.length} activities created\n`)

        // ==================== TEAMS ====================
        console.log('👨‍👩‍👧‍👦 Seeding Teams...')
        const teams = await Promise.all(
            competitions.flatMap((comp, compIdx) =>
                Array.from({ length: 5 }).map((_, teamIdx) => {
                    const teamId = `team-${compIdx}-${teamIdx}`
                    return prisma.team.upsert({
                        where: { id: teamId },
                        create: {
                            id: teamId,
                            competitionId: comp.id,
                            name: `Team ${compIdx}-${teamIdx}`,
                            referenceId: `REF-${compIdx}-${teamIdx}`,
                            paymentStatus: getRandomElement(Object.values(RegistrationStatus)),
                            paymentMethod: getRandomElement(Object.values(PaymentMethod)),
                            paymentDate: new Date(),
                            amountPaid: 1000,
                            isEarlyBird: teamIdx % 2 === 0,
                        },
                        update: {},
                    })
                })
            )
        )
        console.log(`   ✓ ${teams.length} teams created\n`)

        // ==================== TEAM MEMBERS ====================
        console.log('🧑‍🤝‍🧑 Seeding Team Members...')
        const teamMembers = await Promise.all(
            teams.slice(0, 10).flatMap((team, idx) =>
                [0, 1, 2].map((memberIdx) => {
                    const participant = participants[(idx * 3 + memberIdx) % participants.length]
                    return prisma.teamMember.upsert({
                        where: { teamId_participantId: { teamId: team.id, participantId: participant.id } },
                        create: {
                            teamId: team.id,
                            participantId: participant.id,
                            isLeader: memberIdx === 0,
                            cardIssued: memberIdx % 2 === 0,
                        },
                        update: {},
                    })
                })
            )
        )
        console.log(`   ✓ ${teamMembers.length} team members created\n`)

        // ==================== COMPETITION ATTENDANCE ====================
        console.log('✅ Seeding Competition Attendance...')
        const attendances = await Promise.all(
            teamMembers.slice(0, 10).map((member, idx) =>
                prisma.competitionAttendance.upsert({
                    where: { teamId_participantId: { teamId: member.teamId, participantId: member.participantId } },
                    create: {
                        teamId: member.teamId,
                        participantId: member.participantId,
                        status: Math.random() > 0.3,
                        method: getRandomElement(Object.values(AttendanceMethod)),
                        markedAt: new Date(),
                        markedByUserId: staffUsers[0].id,
                    },
                    update: {},
                })
            )
        )
        console.log(`   ✓ ${attendances.length} attendance records created\n`)

        // ==================== PARTICIPANT ACTIVITY COMPLETION ====================
        console.log('🏆 Seeding Participant Activity Completions...')
        const completions = await Promise.all(
            participants.slice(0, 10).flatMap((participant, pIdx) =>
                activities.slice(0, 5).map((activity, aIdx) =>
                    prisma.participantActivityCompletion.upsert({
                        where: { participantId_activityId: { participantId: participant.id, activityId: activity.id } },
                        create: {
                            participantId: participant.id,
                            activityId: activity.id,
                            submissionLink: `https://example.com/submission-${pIdx}-${aIdx}`,
                            completedAt: new Date(),
                            markedByStaffProfileId: staffProfiles[0].id,
                            note: 'Good submission',
                        },
                        update: {},
                    })
                )
            )
        )
        console.log(`   ✓ ${completions.length} activity completions created\n`)

        // ==================== ACTIVITY SUBMISSIONS ====================
        console.log('📤 Seeding Activity Submissions...')
        const submissions = await Promise.all(
            participants.slice(0, 8).flatMap((participant, pIdx) =>
                activities.slice(5, 10).map(async (activity, aIdx) => {
                    const existing = await prisma.activitySubmission.findFirst({
                        where: { participantId: participant.id, activityId: activity.id },
                    })

                    if (existing) return existing

                    return prisma.activitySubmission.create({
                        data: {
                            participantId: participant.id,
                            activityId: activity.id,
                            submissionLink: `https://example.com/submit-${pIdx}-${aIdx}`,
                            submissionText: `Submission text for activity ${activity.name}`,
                            status: getRandomElement(Object.values(SubmissionStatus)),
                            submittedAt: new Date(),
                            reviewedByStaffProfileId: staffProfiles[0].id,
                            reviewedAt: new Date(),
                            reviewNote: 'Great work!',
                        },
                    })
                })
            )
        )
        console.log(`   ✓ ${submissions.length} activity submissions created\n`)

        // ==================== POINTS LEDGER ====================
        console.log('💰 Seeding Points Ledger...')
        const pointsLedger = await Promise.all(
            participants.slice(0, 10).flatMap((participant, idx) =>
                [
                    prisma.pointsLedger.upsert({
                        where: { sourceCompletionId: completions[idx]?.id },
                        create: {
                            participantId: participant.id,
                            entryType: PointsLedgerEntryType.MANUAL_ACTIVITY,
                            pointsDelta: 50,
                            sourceCompletionId: completions[idx]?.id,
                            actorStaffProfileId: staffProfiles[0].id,
                        },
                        update: {},
                    }),
                    prisma.pointsLedger.create({
                        data: {
                            participantId: participant.id,
                            entryType: PointsLedgerEntryType.ADJUSTMENT,
                            pointsDelta: 10,
                            actorStaffProfileId: staffProfiles[0].id,
                        },
                    }),
                ]
            )
        )
        console.log(`   ✓ ${pointsLedger.length} points ledger entries created\n`)

        // ==================== POINTS SUMMARY ====================
        console.log('📊 Seeding Points Summary...')
        const pointsSummary = await Promise.all(
            participants.slice(0, 10).map((participant) =>
                prisma.pointsSummary.upsert({
                    where: { participantId: participant.id },
                    create: {
                        participantId: participant.id,
                        totalPoints: Math.floor(Math.random() * 500) + 50,
                    },
                    update: { totalPoints: Math.floor(Math.random() * 500) + 50 },
                })
            )
        )
        console.log(`   ✓ ${pointsSummary.length} points summary records created\n`)

        // ==================== POINTS AUDIT LOG ====================
        console.log('📝 Seeding Points Audit Log...')
        const auditLogs = await Promise.all(
            Array.from({ length: 10 }).map((_, i) =>
                prisma.pointsAuditLog.create({
                    data: {
                        actorStaffProfileId: staffProfiles[0].id,
                        actionType: getRandomElement(['ACTIVITY_COMPLETION_MARKED', 'POINTS_ADJUSTED', 'ACTIVITY_TYPE_CREATED']),
                        targetType: 'Participant',
                        targetId: participants[i % participants.length].id,
                        note: `Audit log entry ${i + 1}`,
                    },
                })
            )
        )
        console.log(`   ✓ ${auditLogs.length} audit log entries created\n`)

        // ==================== BRAND AMBASSADORS ====================
        console.log('🌟 Seeding Brand Ambassadors...')
        const ambassadorUsers = await Promise.all(
            Array.from({ length: 5 }).map((_, i) => {
                const email = generateEmail(`ambassador${i}`)
                const password = bcryptjs.hashSync('ambassador123', 10)

                return prisma.user.upsert({
                    where: { email },
                    create: {
                        email,
                        password,
                        type: UserType.BRAND_AMBASSADOR,
                        isActive: true,
                    },
                    update: {},
                })
            })
        )

        const ambassadors = await Promise.all(
            ambassadorUsers.map((user, i) =>
                prisma.brandAmbassador.upsert({
                    where: { userId: user.id },
                    create: {
                        userId: user.id,
                        fullName: `Ambassador ${i + 1}`,
                        institute: getRandomElement(institutions),
                        referralCode: generateReferralCode(),
                        cnic: generateCNIC(),
                        phone: generatePhone(),
                        totalReferrals: Math.floor(Math.random() * 50),
                    },
                    update: {},
                })
            )
        )
        console.log(`   ✓ ${ambassadors.length} brand ambassadors created\n`)

        // ==================== COMPANIES ====================
        console.log('🏢 Seeding Companies...')
        const companyUsers = await Promise.all(
            companies.map((_, i) => {
                const email = generateEmail(`company${i}`)
                const password = bcryptjs.hashSync('company123', 10)

                return prisma.user.upsert({
                    where: { email },
                    create: {
                        email,
                        password,
                        type: UserType.PARTICIPANT,
                        isActive: true,
                    },
                    update: {},
                })
            })
        )

        const createdCompanies = await Promise.all(
            companyUsers.map((user, i) =>
                prisma.company.upsert({
                    where: { userId: user.id },
                    create: {
                        userId: user.id,
                        name: companies[i],
                        categoryId: createdCategories[i % createdCategories.length].id,
                        description: `${companies[i]} is a leading technology company`,
                        website: `https://www.${companies[i].toLowerCase().replace(/\s+/g, '')}.com`,
                        contactEmail: user.email,
                        contactPhone: generatePhone(),
                    },
                    update: {},
                })
            )
        )
        console.log(`   ✓ ${createdCompanies.length} companies created\n`)

        // ==================== FOOD STALLS ====================
        console.log('🍔 Seeding Food Stalls...')
        const stallUsers = await Promise.all(
            Array.from({ length: 5 }).map((_, i) => {
                const email = generateEmail(`stall${i}`)
                const password = bcryptjs.hashSync('stall123', 10)

                return prisma.user.upsert({
                    where: { email },
                    create: {
                        email,
                        password,
                        type: UserType.PARTICIPANT,
                        isActive: true,
                    },
                    update: {},
                })
            })
        )

        const foodStalls = await Promise.all(
            stallUsers.map((user, i) =>
                prisma.foodStall.upsert({
                    where: { userId: user.id },
                    create: {
                        userId: user.id,
                        stallName: `Food Stall ${i + 1}`,
                        menuDetails: 'Biryani, Karahi, Pulao, Desserts',
                        paymentStatus: getRandomElement(Object.values(RegistrationStatus)),
                        stallLocation: `Location ${i + 1}`,
                    },
                    update: {},
                })
            )
        )
        console.log(`   ✓ ${foodStalls.length} food stalls created\n`)

        // ==================== TEAM EMAILS QUEUE ====================
        console.log('📧 Seeding Team Emails Queue...')
        const emailQueues = await Promise.all(
            teamMembers.slice(0, 5).map((member) =>
                prisma.teamEmailsQueue.upsert({
                    where: { teamMemberId: member.id },
                    create: {
                        teamMemberId: member.id,
                        sendWelcome: true,
                        retryCount: 0,
                    },
                    update: {},
                })
            )
        )
        console.log(`   ✓ ${emailQueues.length} email queue entries created\n`)

        // ==================== USER ACTIONS ====================
        console.log('🔐 Seeding User Actions...')
        const userActions = await Promise.all(
            staffUsers.slice(0, 3).flatMap((user) =>
                [Action.VIEW_REGISTRATION_DETAILS, Action.EDIT_COMPETITION, Action.UPDATE_ATTENDANCE].map(action =>
                    prisma.userAction.upsert({
                        where: { userId_action: { userId: user.id, action } },
                        create: {
                            userId: user.id,
                            action,
                            grantedBy: staffUsers[0].id,
                        },
                        update: {},
                    })
                )
            )
        )
        console.log(`   ✓ ${userActions.length} user actions created\n`)

        // ==================== MINIGAMES ====================
        console.log('🎮 Seeding Minigames...')
        const minigames = await Promise.all(
            Array.from({ length: 3 }).map((_, i) =>
                prisma.minigame.create({
                    data: {
                        name: `Minigame ${i + 1}`,
                        description: `Description for minigame ${i + 1}`,
                        isActive: true,
                        location: `Booth ${i + 1}`,
                    },
                })
            )
        )
        console.log(`   ✓ ${minigames.length} minigames created\n`)

        // ==================== SCORES ====================
        console.log('🎯 Seeding Scores...')
        const scores = await Promise.all(
            participants.slice(0, 5).flatMap((participant) =>
                minigames.map((game) =>
                    prisma.score.create({
                        data: {
                            userCode: participant.minigameCode!,
                            gameId: game.id,
                            score: Math.floor(Math.random() * 1000),
                            playTime: Math.floor(Math.random() * 600),
                        },
                    })
                )
            )
        )
        console.log(`   ✓ ${scores.length} scores created\n`)

        // ==================== SIGNUP OTP LINKS ====================
        console.log('🔗 Seeding Signup OTP Links...')
        const otpLinks = await Promise.all(
            Array.from({ length: 5 }).map((_, i) =>
                prisma.signupOtpLink.create({
                    data: {
                        email: `newuser${i}@example.com`,
                        fullName: `New User ${i + 1}`,
                        tokenHash: `hash_${Math.random().toString(36).substr(2, 20)}`,
                        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        requestedIp: `192.168.1.${i + 1}`,
                    },
                })
            )
        )
        console.log(`   ✓ ${otpLinks.length} OTP links created\n`)

        console.log('\n✅ Dummy data seed completed successfully!\n')
        console.log('📊 Summary:')
        console.log(`   • Activity Types: ${activityTypes.length}`)
        console.log(`   • Categories: ${createdCategories.length}`)
        console.log(`   • Venues: ${venues.length}`)
        console.log(`   • Competitions: ${competitions.length}`)
        console.log(`   • Participants: ${participants.length}`)
        console.log(`   • Staff Members: ${staffProfiles.length}`)
        console.log(`   • Activities: ${activities.length}`)
        console.log(`   • Teams: ${teams.length}`)
        console.log(`   • Team Members: ${teamMembers.length}`)
        console.log(`   • Competition Attendance: ${attendances.length}`)
        console.log(`   • Activity Completions: ${completions.length}`)
        console.log(`   • Activity Submissions: ${submissions.length}`)
        console.log(`   • Points Ledger Entries: ${pointsLedger.length}`)
        console.log(`   • Brand Ambassadors: ${ambassadors.length}`)
        console.log(`   • Companies: ${createdCompanies.length}`)
        console.log(`   • Food Stalls: ${foodStalls.length}`)
        console.log(`   • Minigames: ${minigames.length}`)
        console.log(`   • Scores: ${scores.length}`)
        console.log(`   • OTP Links: ${otpLinks.length}\n`)

    } catch (error) {
        console.error('❌ Error seeding database:', error)
        throw error
    }
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
