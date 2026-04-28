/**
 * Fix minigame codes to be exactly 6 alphanumeric characters.
 * Finds any participants with codes exceeding 6 characters and regenerates them.
 * Handles uniqueness constraints by retrying on collisions.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' prisma/fix-minigame-codes.ts
 */

import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL },
    },
})

// Generate a 6-character alphanumeric code
function generate6DigitCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
}

// Generate a unique code that doesn't already exist
async function generateUniqueCode(existingCodes: Set<string>): Promise<string> {
    let attempts = 0
    const maxAttempts = 1000
    
    while (attempts < maxAttempts) {
        const code = generate6DigitCode()
        if (!existingCodes.has(code)) {
            existingCodes.add(code)
            return code
        }
        attempts++
    }
    
    throw new Error(`Could not generate unique 6-digit code after ${maxAttempts} attempts`)
}

async function main() {
    console.log('🔧 Starting minigame code fix...\n')

    try {
        // Fetch all participants with minigameCode
        const participants = await prisma.participant.findMany({
            where: {
                minigameCode: { not: null },
            },
            select: {
                id: true,
                email: true,
                minigameCode: true,
            },
        })

        console.log(`📊 Found ${participants.length} participants with minigame codes\n`)

        // Get all existing valid codes (6 chars or less)
        const existingValidCodes = new Set<string>()
        const codesToFix: Array<{ id: string; email: string; oldCode: string }> = []

        for (const p of participants) {
            if (p.minigameCode) {
                if (p.minigameCode.length <= 6) {
                    existingValidCodes.add(p.minigameCode)
                } else {
                    codesToFix.push({
                        id: p.id,
                        email: p.email,
                        oldCode: p.minigameCode,
                    })
                }
            }
        }

        if (codesToFix.length === 0) {
            console.log('✅ All minigame codes are already 6 characters or less!')
            return
        }

        console.log(`⚠️  Found ${codesToFix.length} codes exceeding 6 characters\n`)
        console.log('🔄 Regenerating codes...')

        let fixed = 0
        let failed = 0

        for (const item of codesToFix) {
            try {
                const newCode = await generateUniqueCode(existingValidCodes)

                await prisma.participant.update({
                    where: { id: item.id },
                    data: { minigameCode: newCode },
                })

                console.log(`   ✓ ${item.email}: ${item.oldCode} → ${newCode}`)
                fixed++
            } catch (err) {
                console.error(`   ✗ ${item.email}: Failed to update`)
                failed++
            }
        }

        console.log(`\n✅ Fix complete!`)
        console.log(`   • Fixed: ${fixed}`)
        console.log(`   • Failed: ${failed}`)
        console.log(`   • Total: ${codesToFix.length}\n`)
    } catch (err) {
        console.error('❌ Fix failed:', err)
        process.exit(1)
    } finally {
        await prisma.$disconnect()
    }
}

main()
