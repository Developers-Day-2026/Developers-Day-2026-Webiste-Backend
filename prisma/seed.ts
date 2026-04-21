import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import { loadCompetitionCsvRows, getTeamSizeFromRaw } from '../src/utils/competitionsCsv'

dotenv.config()

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
})

async function main() {
    console.log('🌱 Starting seed (competitions only)...\n')

    const day = new Date('2026-03-15')

    console.log('📚 Seeding DevDay competitions from CSV...')
    const csvRows = loadCompetitionCsvRows()

    for (const row of csvRows) {
        if (!row.name) continue

        const { min, max } = getTeamSizeFromRaw(row.teamCountRaw)

        const startHour = 9
        const startTime = new Date(`2026-03-15T${String(startHour).padStart(2, '0')}:00:00`)
        const endTime   = new Date(startTime.getTime() + 2 * 60 * 60 * 1000)

        const slug = row.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 40)

        const id = `comp-${slug || 'unnamed'}`

        await prisma.competition.upsert({
            where: { id },
            create: {
                id,
                name:        row.name,
                description: row.description || null,
                fee:         row.normalPrice || row.earlyBirdPrice || 0,
                minTeamSize: min,
                maxTeamSize: max,
                capacityLimit: 100,
                compDay:     day,
                startTime,
                endTime,
                registrationDeadline: new Date('2026-03-10T23:59:00'),
            },
            update: {
                description: row.description || null,
                fee:         row.normalPrice || row.earlyBirdPrice || 0,
                minTeamSize: min,
                maxTeamSize: max,
            },
        })
    }
    console.log(`   ✓ ${csvRows.length} competitions from CSV\n`)

    console.log('✅ Seed complete (competitions only)\n')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
