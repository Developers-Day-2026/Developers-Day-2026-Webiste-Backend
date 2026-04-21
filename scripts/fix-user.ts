/**
 * Fix script for k230061@nu.edu.pk
 * 
 * Problems found:
 *   1. Supabase app_metadata.role = EXCOM but Prisma staffRole = SUPERADMIN
 *   2. Supabase user ID ≠ Prisma user ID (existing participant was re-registered as staff)
 * 
 * Fixes:
 *   1. Update Supabase app_metadata.role to SUPERADMIN (matches Prisma)
 *   2. NO database deletion — just sync Supabase to match Prisma
 * 
 * Run: npx ts-node --project scripts/tsconfig.json scripts/fix-user.ts
 */

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL } },
})

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SECRET_API_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

const TARGET_EMAIL = 'k230061@nu.edu.pk'

async function main() {
    console.log('=== Fixing user:', TARGET_EMAIL, '===\n')

    // 1. Get current state
    const prismaUser = await prisma.user.findUnique({
        where: { email: TARGET_EMAIL },
        include: { staffProfile: true },
    })

    if (!prismaUser || !prismaUser.staffProfile) {
        console.error('❌ Prisma user or StaffProfile not found!')
        return
    }

    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const supabaseUser = listData?.users?.find((u) => u.email === TARGET_EMAIL)

    if (!supabaseUser) {
        console.error('❌ Supabase user not found!')
        return
    }

    const prismaRole = prismaUser.staffProfile.staffRole
    const supabaseRole = supabaseUser.app_metadata?.role

    console.log('Current state:')
    console.log('   Prisma StaffRole:     ', prismaRole)
    console.log('   Supabase app_metadata:', supabaseRole)
    console.log('   Prisma User ID:       ', prismaUser.id)
    console.log('   Supabase User ID:     ', supabaseUser.id)
    console.log()

    // 2. Fix: Update Supabase app_metadata.role to match Prisma
    if (supabaseRole !== prismaRole) {
        console.log(`🔧 Updating Supabase app_metadata.role: ${supabaseRole} → ${prismaRole}`)
        
        const { error } = await supabaseAdmin.auth.admin.updateUserById(supabaseUser.id, {
            app_metadata: { role: prismaRole },
            user_metadata: { 
                ...supabaseUser.user_metadata,
                role: prismaRole,
            },
        })

        if (error) {
            console.error('❌ Failed to update Supabase user:', error.message)
            return
        }
        console.log('✅ Supabase app_metadata.role updated to', prismaRole)
    } else {
        console.log('ℹ️  Supabase role already matches Prisma — no update needed')
    }

    // 3. Verify the fix
    console.log('\n=== Verifying fix ===\n')
    
    const { data: verifyData } = await supabaseAdmin.auth.admin.getUserById(supabaseUser.id)
    if (verifyData?.user) {
        console.log('   Supabase app_metadata:', JSON.stringify(verifyData.user.app_metadata))
        console.log('   Supabase user_metadata:', JSON.stringify(verifyData.user.user_metadata))
        
        const role = verifyData.user.app_metadata?.role
        if (role === prismaRole) {
            console.log('\n✅ Fix verified — Supabase role now matches Prisma')
        } else {
            console.log('\n⚠️  Role still doesn\'t match! app_metadata.role =', role)
        }
    }

    console.log('\n📋 Summary:')
    console.log('   The user needs to LOG OUT and LOG BACK IN to get a new JWT token')
    console.log('   with the correct role. The old cached tokens will have EXCOM.')
    console.log()
    console.log('   Note: The ID mismatch (Prisma vs Supabase) is handled by the')
    console.log('   email fallback in getUserEffectiveActions. No DB changes needed.')
}

main()
    .catch((e) => { console.error('❌ Script failed:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
