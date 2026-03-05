import { PrismaClient, StaffRole, UserType, RegistrationStatus, AttendanceMethod, PaymentMethod } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
})


const ids = {
    venues: ['v-001', 'v-002', 'v-003', 'v-004', 'v-005', 'v-006'],

    categories: ['cat-001', 'cat-002', 'cat-003', 'cat-004', 'cat-005'],

    staff: {
        superadmin:             'staff-superadmin-001',
        excom:                  'staff-excom-001',
        pr:                     'staff-pr-001',
        gr:                     'staff-gr-001',
        food:                   'staff-food-001',
        competitions:           'staff-comp-001',
        ambassadorManagement:   'staff-ambmgmt-001',
    },

    participantUsers: ['puser-001', 'puser-002', 'puser-003', 'puser-004', 'puser-005'],
    participants:     ['part-001',  'part-002',  'part-003',  'part-004',  'part-005'],

    companyUsers: ['cuser-001', 'cuser-002', 'cuser-003', 'cuser-004', 'cuser-005'],
    companies:    ['comp-001',  'comp-002',  'comp-003',  'comp-004',  'comp-005'],

    stallUsers: ['suser-001', 'suser-002', 'suser-003', 'suser-004', 'suser-005'],
    stalls:     ['stall-001', 'stall-002', 'stall-003', 'stall-004', 'stall-005'],

    baUsers: ['buser-001', 'buser-002', 'buser-003', 'buser-004', 'buser-005'],
    bas:     ['ba-001',    'ba-002',    'ba-003',    'ba-004',    'ba-005'],

    competitions: ['comp-c-001', 'comp-c-002', 'comp-c-003', 'comp-c-004', 'comp-c-005'],

    teams: ['team-001', 'team-002', 'team-003', 'team-004', 'team-005'],
}

async function main() {
    console.log('🌱 Starting seed...\n')

    console.log('📍 Seeding venues...')

    const venueData = [
        { id: ids.venues[0], name: 'LAB 1', location: 'Block A, 1st Floor', capacity: 60, facilities: '30 Workstations, High-Speed Internet, AC' },
        { id: ids.venues[1], name: 'LAB 2', location: 'Block A, 1st Floor', capacity: 60, facilities: '30 Workstations, High-Speed Internet, AC' },
        { id: ids.venues[2], name: 'LAB 3', location: 'Block B, 2nd Floor', capacity: 60, facilities: '30 Workstations, High-Speed Internet, AC' },
        { id: ids.venues[3], name: 'LAB 4', location: 'Block B, 2nd Floor', capacity: 60, facilities: '30 Workstations, High-Speed Internet, AC' },
        { id: ids.venues[4], name: 'LAB 5', location: 'Block C, 3rd Floor', capacity: 60, facilities: '30 Workstations, High-Speed Internet, AC' },
        { id: ids.venues[5], name: 'LAB 6', location: 'Block C, 3rd Floor', capacity: 60, facilities: '30 Workstations, High-Speed Internet, AC' },
    ]

    for (const v of venueData) {
        await prisma.venue.upsert({ where: { id: v.id }, create: v, update: v })
    }
    console.log(`   ✓ ${venueData.length} venues\n`)

    console.log('🏷️  Seeding categories...')

    const categoryData = [
        { id: ids.categories[0], name: 'Technology',    description: 'Software, hardware, and IT companies' },
        { id: ids.categories[1], name: 'Finance',       description: 'FinTech, banking, and investment firms' },
        { id: ids.categories[2], name: 'Healthcare',    description: 'Medical technology and health services' },
        { id: ids.categories[3], name: 'Energy',        description: 'Renewable energy and sustainability' },
        { id: ids.categories[4], name: 'Education',     description: 'EdTech and training institutions' },
    ]

    for (const c of categoryData) {
        await prisma.category.upsert({ where: { id: c.id }, create: c, update: c })
    }
    console.log(`   ✓ ${categoryData.length} categories\n`)

    console.log('👷 Seeding staff...')

    const staffData = [
        {
            userId: ids.staff.superadmin,
            email:  'k230001@nu.edu.pk',
            role:   StaffRole.SUPERADMIN,
            fullName: 'Sarah Ahmed',
            nuId:   '23K-0001',
        },
        {
            userId: ids.staff.excom,
            email:  'k230002@nu.edu.pk',
            role:   StaffRole.EXCOM,
            fullName: 'Omar Khan',
            nuId:   '23K-0002',
        },
        {
            userId: ids.staff.pr,
            email:  'i230003@nu.edu.pk',
            role:   StaffRole.PR,
            fullName: 'Zainab Malik',
            nuId:   '23I-0003',
        },
        {
            userId: ids.staff.gr,
            email:  'l230004@nu.edu.pk',
            role:   StaffRole.GR,
            fullName: 'Ali Hassan',
            nuId:   '23L-0004',
        },
        {
            userId: ids.staff.food,
            email:  'p230005@nu.edu.pk',
            role:   StaffRole.FOOD,
            fullName: 'Fatima Sheikh',
            nuId:   '23P-0005',
        },
        {
            userId: ids.staff.competitions,
            email:  'k230006@nu.edu.pk',
            role:   StaffRole.COMPETITIONS,
            fullName: 'Ahmed Raza',
            nuId:   '23K-0006',
        },
        {
            userId: ids.staff.ambassadorManagement,
            email:  'k230007@nu.edu.pk',
            role:   StaffRole.AMBASSADOR_MANAGEMENT,
            fullName: 'Nadia Farooq',
            nuId:   '23K-0007',
        },
    ]

    for (const s of staffData) {
        await prisma.user.upsert({
            where:  { id: s.userId },
            create: { id: s.userId, email: s.email, type: UserType.STAFF, isActive: true },
            update: { email: s.email },
        })
        await prisma.staffProfile.upsert({
            where:  { id: s.userId },
            create: { id: s.userId, fullName: s.fullName, nuId: s.nuId, staffRole: s.role, isApproved: true, approvedAt: new Date() },
            update: { fullName: s.fullName, staffRole: s.role, isApproved: true },
        })
    }
    console.log(`   ✓ ${staffData.length} staff members\n`)

    console.log('🎓 Seeding participants...')

    const participantData = [
        { userId: ids.participantUsers[0], pId: ids.participants[0], email: 'ali.student@gmail.com',    fullName: 'Ali Usman',       cnic: '4210112345671', phone: '03001234567', institution: 'FAST NUCES Karachi' },
        { userId: ids.participantUsers[1], pId: ids.participants[1], email: 'hira.dev@outlook.com',    fullName: 'Hira Baig',       cnic: '4210112345672', phone: '03011234567', institution: 'NED University' },
        { userId: ids.participantUsers[2], pId: ids.participants[2], email: 'usman.code@gmail.com',    fullName: 'Usman Tariq',     cnic: '4210112345673', phone: '03021234567', institution: 'IBA Karachi' },
        { userId: ids.participantUsers[3], pId: ids.participants[3], email: 'ayesha.tech@gmail.com',   fullName: 'Ayesha Siddiqui', cnic: '4210112345674', phone: '03031234567', institution: 'LUMS' },
        { userId: ids.participantUsers[4], pId: ids.participants[4], email: 'bilal.eng@hotmail.com',   fullName: 'Bilal Mirza',     cnic: '4210112345675', phone: '03041234567', institution: 'GIKI' },
    ]

    for (const p of participantData) {
        await prisma.user.upsert({
            where:  { id: p.userId },
            create: { id: p.userId, email: p.email, type: UserType.PARTICIPANT, isActive: true },
            update: { email: p.email },
        })
        await prisma.participant.upsert({
            where:  { id: p.pId },
            create: { id: p.pId, userId: p.userId, email: p.email, fullName: p.fullName, cnic: p.cnic, phone: p.phone, institution: p.institution },
            update: { fullName: p.fullName, phone: p.phone, institution: p.institution },
        })
    }
    console.log(`   ✓ ${participantData.length} participants\n`)

    console.log('🏢 Seeding companies...')

    const companyData = [
        { userId: ids.companyUsers[0], cId: ids.companies[0], catId: ids.categories[0], name: 'Systems Ltd',       website: 'https://systemsltd.com',  contactEmail: 'hr@systemsltd.com',  contactPhone: '02135600000', description: 'Leading IT services company in Pakistan.' },
        { userId: ids.companyUsers[1], cId: ids.companies[1], catId: ids.categories[1], name: 'Meezan Bank',       website: 'https://meezanbank.com',   contactEmail: 'hr@meezan.com.pk',   contactPhone: '02111331331', description: 'Pakistan\'s premier Islamic bank.' },
        { userId: ids.companyUsers[2], cId: ids.companies[2], catId: ids.categories[2], name: 'Sehat Kahani',      website: 'https://sehatkahani.com',  contactEmail: 'info@sehatkahani.com', contactPhone: '03001234000', description: 'Telehealth platform connecting patients to doctors.' },
        { userId: ids.companyUsers[3], cId: ids.companies[3], catId: ids.categories[3], name: 'Zorlu Energy PK',   website: 'https://zorlu.com.pk',     contactEmail: 'pk@zorlu.com',       contactPhone: '03111234567', description: 'Renewable energy solutions provider.' },
        { userId: ids.companyUsers[4], cId: ids.companies[4], catId: ids.categories[4], name: 'Sabaq Foundation',  website: 'https://sabaq.pk',         contactEmail: 'info@sabaq.pk',      contactPhone: '04235001234', description: 'Free online education for Pakistani students.' },
    ]

    for (const c of companyData) {
        await prisma.user.upsert({
            where:  { id: c.userId },
            create: { id: c.userId, email: c.contactEmail, type: UserType.PARTICIPANT, isActive: true },
            update: { email: c.contactEmail },
        })
        await prisma.company.upsert({
            where:  { id: c.cId },
            create: { id: c.cId, userId: c.userId, name: c.name, categoryId: c.catId, website: c.website, contactEmail: c.contactEmail, contactPhone: c.contactPhone, description: c.description },
            update: { name: c.name, categoryId: c.catId, website: c.website, description: c.description },
        })
    }
    console.log(`   ✓ ${companyData.length} companies\n`)

    console.log('🍔 Seeding food stalls...')

    const stallData = [
        { userId: ids.stallUsers[0], sId: ids.stalls[0], stallName: 'Biryani Wala',   status: RegistrationStatus.VERIFIED,       location: 'Stall A-1', menu: 'Chicken Biryani, Mutton Biryani, Raita, Cold Drinks' },
        { userId: ids.stallUsers[1], sId: ids.stalls[1], stallName: 'Burger Point',   status: RegistrationStatus.VERIFIED,       location: 'Stall A-2', menu: 'Beef Burger, Chicken Zinger, Fries, Shakes' },
        { userId: ids.stallUsers[2], sId: ids.stalls[2], stallName: 'Chai Khana',     status: RegistrationStatus.PENDING_PAYMENT, location: 'Stall B-1', menu: 'Chai, Coffee, Samosas, Pakoras' },
        { userId: ids.stallUsers[3], sId: ids.stalls[3], stallName: 'Pizza Express',  status: RegistrationStatus.VERIFIED,       location: 'Stall B-2', menu: 'Margherita, BBQ Chicken, Pepperoni, Garlic Bread' },
        { userId: ids.stallUsers[4], sId: ids.stalls[4], stallName: 'Roll Hub',       status: RegistrationStatus.PENDING_PAYMENT, location: 'Stall C-1', menu: 'Chicken Roll, Egg Roll, Paratha Roll, Juices' },
    ]

    const stallEmails = ['biryani@food.pk', 'burger@food.pk', 'chai@food.pk', 'pizza@food.pk', 'rollhub@food.pk']

    for (let i = 0; i < stallData.length; i++) {
        const s = stallData[i]
        await prisma.user.upsert({
            where:  { id: s.userId },
            create: { id: s.userId, email: stallEmails[i], type: UserType.PARTICIPANT, isActive: true },
            update: { email: stallEmails[i] },
        })
        await prisma.foodStall.upsert({
            where:  { id: s.sId },
            create: { id: s.sId, userId: s.userId, stallName: s.stallName, paymentStatus: s.status, stallLocation: s.location, menuDetails: s.menu },
            update: { stallName: s.stallName, paymentStatus: s.status, stallLocation: s.location, menuDetails: s.menu },
        })
    }
    console.log(`   ✓ ${stallData.length} food stalls\n`)

    console.log('📣 Seeding brand ambassadors...')

    // First 2 ambassadors share a User with participants (demonstrating multi-profile support)
    const baData = [
        // Ali Usman (puser-001) is also an ambassador — uses same userId
        { userId: ids.participantUsers[0], baId: ids.bas[0], fullName: 'Ali Usman',       cnic: '4210112345671', email: 'ali.student@gmail.com',   institute: 'FAST NUCES Karachi',    referralCode: 'ALIUU-DD26', referrals: 12 },
        // Hira Baig (puser-002) is also an ambassador — uses same userId
        { userId: ids.participantUsers[1], baId: ids.bas[1], fullName: 'Hira Baig',       cnic: '4210112345672', email: 'hira.dev@outlook.com',    institute: 'NED University',        referralCode: 'HIRAB-DD26', referrals: 8  },
        // Rest are standalone ambassador-only users
        { userId: ids.baUsers[2],          baId: ids.bas[2], fullName: 'Saad Farooqui',   cnic: '4210112345683', email: 'saad.ba@gmail.com',       institute: 'Szabist',               referralCode: 'SAADF-DD26', referrals: 15 },
        { userId: ids.baUsers[3],          baId: ids.bas[3], fullName: 'Noor Fatima',     cnic: '4210112345684', email: 'noor.ba@gmail.com',       institute: 'Iqra University',       referralCode: 'NOORF-DD26', referrals: 5  },
        { userId: ids.baUsers[4],          baId: ids.bas[4], fullName: 'Arslan Sher',     cnic: '4210112345685', email: 'arslan.ba@gmail.com',     institute: 'Sir Syed University',   referralCode: 'ARSLN-DD26', referrals: 20 },
    ]

    for (const ba of baData) {
        // Only create a new User if this userId doesn't already exist (shared users already created above)
        await prisma.user.upsert({
            where:  { id: ba.userId },
            create: { id: ba.userId, email: ba.email, type: UserType.PARTICIPANT, isActive: true },
            update: {},
        })
        await prisma.brandAmbassador.upsert({
            where:  { id: ba.baId },
            create: { id: ba.baId, userId: ba.userId, fullName: ba.fullName, cnic: ba.cnic, institute: ba.institute, referralCode: ba.referralCode, totalReferrals: ba.referrals },
            update: { fullName: ba.fullName, cnic: ba.cnic, institute: ba.institute, totalReferrals: ba.referrals },
        })
    }
    console.log(`   ✓ ${baData.length} brand ambassadors (2 shared with participants)\n`)

    console.log('🏆 Seeding competitions...')

    const now   = new Date('2026-03-15')
    const day   = new Date('2026-03-15')

    const competitionData = [
        {
            id: ids.competitions[0], name: 'Speed Programming',
            description: 'Solve algorithmic challenges under time pressure. Individual or team submission.',
            venueIds: [ids.venues[0]], fee: 500, minTeamSize: 1, maxTeamSize: 2, capacityLimit: 60,
            compDay: day, startTime: new Date('2026-03-15T09:00:00'), endTime: new Date('2026-03-15T12:00:00'),
            registrationDeadline: new Date('2026-03-10T23:59:00'),
        },
        {
            id: ids.competitions[1], name: 'Idea Incubator',
            description: 'Pitch your startup idea to a panel of industry judges. Best pitch wins.',
            venueIds: [ids.venues[1]], fee: 300, minTeamSize: 2, maxTeamSize: 4, capacityLimit: 40,
            compDay: day, startTime: new Date('2026-03-15T10:00:00'), endTime: new Date('2026-03-15T14:00:00'),
            registrationDeadline: new Date('2026-03-10T23:59:00'),
        },
        {
            id: ids.competitions[2], name: 'Robo Wars',
            description: 'Battle of autonomous robots. Build, program, and fight.',
            venueIds: [ids.venues[2], ids.venues[3]], fee: 1000, minTeamSize: 2, maxTeamSize: 4, capacityLimit: 20,
            compDay: day, startTime: new Date('2026-03-15T11:00:00'), endTime: new Date('2026-03-15T16:00:00'),
            registrationDeadline: new Date('2026-03-08T23:59:00'),
        },
        {
            id: ids.competitions[3], name: 'UI/UX Design Sprint',
            description: 'Design a complete product flow for a given problem statement in 3 hours.',
            venueIds: [ids.venues[4]], fee: 400, minTeamSize: 1, maxTeamSize: 3, capacityLimit: 45,
            compDay: day, startTime: new Date('2026-03-15T09:30:00'), endTime: new Date('2026-03-15T13:00:00'),
            registrationDeadline: new Date('2026-03-10T23:59:00'),
        },
        {
            id: ids.competitions[4], name: 'Capture The Flag',
            description: 'Cybersecurity challenge. Exploit, recover flags, win.',
            venueIds: [ids.venues[5]], fee: 600, minTeamSize: 2, maxTeamSize: 3, capacityLimit: 30,
            compDay: day, startTime: new Date('2026-03-15T10:00:00'), endTime: new Date('2026-03-15T17:00:00'),
            registrationDeadline: new Date('2026-03-09T23:59:00'),
        },
    ]

    for (const c of competitionData) {
        const { venueIds, ...rest } = c
        await prisma.competition.upsert({
            where:  { id: c.id },
            create: { ...rest, venues: { connect: venueIds.map((id) => ({ id })) } },
            update: { name: c.name, description: c.description, fee: c.fee, venues: { set: venueIds.map((id) => ({ id })) } },
        })
    }
    console.log(`   ✓ ${competitionData.length} competitions\n`)

    console.log('👥 Seeding teams...')

    const teamData = [
        { id: ids.teams[0], competitionId: ids.competitions[0], name: 'ByteBlasters',  referenceId: 'SP-2026-001', paymentStatus: RegistrationStatus.VERIFIED,        paymentMethod: PaymentMethod.BANK_TRANSFER, amountPaid: 1000, declaredTID: 'TXN0001', paymentDate: now },
        { id: ids.teams[1], competitionId: ids.competitions[1], name: 'Visionaries',   referenceId: 'II-2026-001', paymentStatus: RegistrationStatus.VERIFIED,        paymentMethod: PaymentMethod.EASYPAISA,     amountPaid: 600,  declaredTID: 'TXN0002', paymentDate: now },
        { id: ids.teams[2], competitionId: ids.competitions[2], name: 'Iron Claws',    referenceId: 'RW-2026-001', paymentStatus: RegistrationStatus.VERIFIED,        paymentMethod: PaymentMethod.JAZZCASH,      amountPaid: 2000, declaredTID: 'TXN0003', paymentDate: now },
        { id: ids.teams[3], competitionId: ids.competitions[3], name: 'PixelPerfect',  referenceId: 'UX-2026-001', paymentStatus: RegistrationStatus.PENDING_PAYMENT, paymentMethod: null,                        amountPaid: null, declaredTID: null,       paymentDate: null },
        { id: ids.teams[4], competitionId: ids.competitions[4], name: 'Root Access',   referenceId: 'CTF-2026-001', paymentStatus: RegistrationStatus.VERIFIED,       paymentMethod: PaymentMethod.BANK_TRANSFER, amountPaid: 1200, declaredTID: 'TXN0005', paymentDate: now },
    ]

    for (const t of teamData) {
        await prisma.team.upsert({
            where:  { id: t.id },
            create: t,
            update: { name: t.name, paymentStatus: t.paymentStatus, paymentMethod: t.paymentMethod, amountPaid: t.amountPaid },
        })
    }
    console.log(`   ✓ ${teamData.length} teams\n`)

    console.log('🔗 Seeding team members...')

    const teamMemberData = [
        // ByteBlasters (team 0) — size 2
        { teamId: ids.teams[0], participantId: ids.participants[0], isLeader: true,  cardIssued: true,  cardIssuedAt: now },
        { teamId: ids.teams[0], participantId: ids.participants[1], isLeader: false, cardIssued: true,  cardIssuedAt: now },
        // Visionaries (team 1) — size 2
        { teamId: ids.teams[1], participantId: ids.participants[2], isLeader: true,  cardIssued: true,  cardIssuedAt: now },
        { teamId: ids.teams[1], participantId: ids.participants[3], isLeader: false, cardIssued: false, cardIssuedAt: null },
        // Iron Claws (team 2) — size 2
        { teamId: ids.teams[2], participantId: ids.participants[4], isLeader: true,  cardIssued: true,  cardIssuedAt: now },
        { teamId: ids.teams[2], participantId: ids.participants[0], isLeader: false, cardIssued: false, cardIssuedAt: null },
        // PixelPerfect (team 3) — solo
        { teamId: ids.teams[3], participantId: ids.participants[1], isLeader: true,  cardIssued: false, cardIssuedAt: null },
        // Root Access (team 4) — size 2
        { teamId: ids.teams[4], participantId: ids.participants[2], isLeader: true,  cardIssued: true,  cardIssuedAt: now },
        { teamId: ids.teams[4], participantId: ids.participants[3], isLeader: false, cardIssued: true,  cardIssuedAt: now },
    ]

    for (const tm of teamMemberData) {
        await prisma.teamMember.upsert({
            where:  { teamId_participantId: { teamId: tm.teamId, participantId: tm.participantId } },
            create: tm,
            update: { isLeader: tm.isLeader, cardIssued: tm.cardIssued, cardIssuedAt: tm.cardIssuedAt },
        })
    }
    console.log(`   ✓ ${teamMemberData.length} team member records\n`)

    console.log('✅ Seeding competition attendances...')

    const attendanceData = [
        { teamId: ids.teams[0], participantId: ids.participants[0], method: AttendanceMethod.STAFF_QR,        markedByUserId: ids.staff.competitions, notes: 'Arrived on time' },
        { teamId: ids.teams[0], participantId: ids.participants[1], method: AttendanceMethod.STAFF_QR,        markedByUserId: ids.staff.competitions, notes: null },
        { teamId: ids.teams[1], participantId: ids.participants[2], method: AttendanceMethod.SELF_GEOFENCE,   markedByUserId: null,                   notes: 'Self check-in via mobile' },
        { teamId: ids.teams[1], participantId: ids.participants[3], method: AttendanceMethod.STAFF_SOFT_MARK, markedByUserId: ids.staff.competitions, notes: 'Manual mark by staff' },
        { teamId: ids.teams[2], participantId: ids.participants[4], method: AttendanceMethod.STAFF_QR,        markedByUserId: ids.staff.competitions, notes: null },
    ]

    for (const a of attendanceData) {
        await prisma.competitionAttendance.upsert({
            where:  { teamId_participantId: { teamId: a.teamId, participantId: a.participantId } },
            create: { ...a, status: true },
            update: { method: a.method, notes: a.notes, markedByUserId: a.markedByUserId },
        })
    }
    console.log(`   ✓ ${attendanceData.length} attendance records\n`)

    console.log('✅ Seed complete!\n')
    console.log('  Venues:              ', venueData.length)
    console.log('  Categories:          ', categoryData.length)
    console.log('  Staff:               ', staffData.length, '  (roles: SUPERADMIN, EXCOM, PR, GR, FOOD, COMPETITIONS, AMBASSADOR_MANAGEMENT)')
    console.log('  Participants:        ', participantData.length)
    console.log('  Companies:           ', companyData.length)
    console.log('  Food Stalls:         ', stallData.length)
    console.log('  Brand Ambassadors:   ', baData.length)
    console.log('  Competitions:        ', competitionData.length)
    console.log('  Teams:               ', teamData.length)
    console.log('  Team Members:        ', teamMemberData.length)
    console.log('  Attendances:         ', attendanceData.length)
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
