/**
 * Diagnostic script: check user state for k230061@nu.edu.pk
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/check-user.ts
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
    console.log('=== Checking user:', TARGET_EMAIL, '===\n')

    // 1. Check Prisma User
    const prismaUser = await prisma.user.findUnique({
        where: { email: TARGET_EMAIL },
        include: {
            staffProfile: true,
            grantedActions: true,
            participant: true,
        },
    })

    if (!prismaUser) {
        console.log('❌ No Prisma user found with this email!')
    } else {
        console.log('✅ Prisma User found:')
        console.log('   ID:       ', prismaUser.id)
        console.log('   Email:    ', prismaUser.email)
        console.log('   Type:     ', prismaUser.type)
        console.log('   IsActive: ', prismaUser.isActive)
        console.log('   Password: ', prismaUser.password ? '(set)' : '(null)')
        console.log()

        if (prismaUser.staffProfile) {
            console.log('✅ StaffProfile found:')
            console.log('   ID:         ', prismaUser.staffProfile.id)
            console.log('   FullName:   ', prismaUser.staffProfile.fullName)
            console.log('   NuId:       ', prismaUser.staffProfile.nuId)
            console.log('   StaffRole:  ', prismaUser.staffProfile.staffRole)
            console.log('   IsApproved: ', prismaUser.staffProfile.isApproved)
            console.log('   ApprovedAt: ', prismaUser.staffProfile.approvedAt)
        } else {
            console.log('❌ No StaffProfile found!')
        }
        console.log()

        if (prismaUser.grantedActions.length > 0) {
            console.log('✅ Granted Actions:')
            for (const action of prismaUser.grantedActions) {
                console.log('   -', action.action)
            }
        } else {
            console.log('ℹ️  No extra granted actions (will use role defaults only)')
        }
        console.log()

        if (prismaUser.participant) {
            console.log('ℹ️  Also has Participant profile:')
            console.log('   Participant ID:', prismaUser.participant.id)
            console.log('   Name:         ', prismaUser.participant.fullName)
        }
    }

    // 2. Check Supabase Auth
    console.log('\n=== Checking Supabase Auth ===\n')
    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
    const supabaseUser = listData?.users?.find((u) => u.email === TARGET_EMAIL)

    if (!supabaseUser) {
        console.log('❌ No Supabase auth user found with this email!')
    } else {
        console.log('✅ Supabase Auth User found:')
        console.log('   ID:          ', supabaseUser.id)
        console.log('   Email:       ', supabaseUser.email)
        console.log('   App Metadata:', JSON.stringify(supabaseUser.app_metadata))
        console.log('   User Metadata:', JSON.stringify(supabaseUser.user_metadata))
        console.log('   Created At:  ', supabaseUser.created_at)
        console.log('   Confirmed:   ', supabaseUser.email_confirmed_at ? 'Yes' : 'No')
    }

    // 3. Compare IDs
    if (prismaUser && supabaseUser) {
        console.log('\n=== ID Comparison ===\n')
        console.log('   Prisma User ID:  ', prismaUser.id)
        console.log('   Supabase User ID:', supabaseUser.id)
        console.log('   StaffProfile ID: ', prismaUser.staffProfile?.id ?? 'N/A')
        
        if (prismaUser.id === supabaseUser.id) {
            console.log('\n   ✅ IDs MATCH — permission lookup by ID should work')
        } else {
            console.log('\n   ⚠️  IDs DO NOT MATCH!')
            console.log('   The Supabase auth ID differs from the Prisma user ID.')
            console.log('   Backend auth middleware sets req.userId = Supabase ID')
            console.log('   Permission lookup by Supabase ID will NOT find the user!')
            console.log('   It should fall back to email lookup, but let\'s verify...')

            // Check if looking up by Supabase ID finds anything
            const bySupabaseId = await prisma.user.findUnique({
                where: { id: supabaseUser.id },
                include: { staffProfile: true },
            })
            if (bySupabaseId) {
                console.log('\n   ⚠️  A DIFFERENT Prisma user exists with Supabase ID:')
                console.log('      Email:', bySupabaseId.email)
                console.log('      Type: ', bySupabaseId.type)
                console.log('      Has StaffProfile:', !!bySupabaseId.staffProfile)
                console.log('      → This user would be found first, before email fallback!')
            } else {
                console.log('\n   ℹ️  No Prisma user exists with Supabase ID — email fallback should work')
            }
        }
    }

    // 4. Simulate permission check
    if (prismaUser?.staffProfile) {
        console.log('\n=== Simulating Permission Check ===\n')
        const ROLE_DEFAULT_ACTIONS: Record<string, string[]> = {
            SUPERADMIN: [
                'VIEW_REGISTRATION_DETAILS', 'EDIT_COMPETITION', 'VIEW_STALL_DETAILS',
                'ADD_NEW_STALL', 'EDIT_STALL', 'DELETE_STALL', 'VIEW_ALL_COMPANIES',
                'ADD_NEW_COMPANY', 'ASSIGN_BOOTH', 'EDIT_COMPANY', 'DELETE_COMPANY',
                'CREATE_NEW_REGISTRATION', 'UPDATE_ATTENDANCE', 'VIEW_ALL_PORTAL_USERS',
                'ASSIGN_ACTIONS_TO_USERS', 'CREATE_ACCOUNTS', 'UPDATE_PARTICIPANT_RECORD',
                'VIEW_AMBASSADOR_DASHBOARD', 'MANAGE_AMBASSADORS',
            ],
        }
        const roleDefaults = ROLE_DEFAULT_ACTIONS[prismaUser.staffProfile.staffRole] ?? []
        const extraEnums = prismaUser.grantedActions.map((a) => a.action)
        const effective = [...new Set([...roleDefaults, ...extraEnums])]

        console.log('   Staff Role:', prismaUser.staffProfile.staffRole)
        console.log('   Role defaults count:', roleDefaults.length)
        console.log('   Extra grants count:', extraEnums.length)
        console.log('   Effective actions count:', effective.length)
        console.log('   Has VIEW_REGISTRATION_DETAILS:', effective.includes('VIEW_REGISTRATION_DETAILS'))
    }
}

main()
    .catch((e) => { console.error('❌ Script failed:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
