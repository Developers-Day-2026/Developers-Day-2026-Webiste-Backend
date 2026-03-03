/**
 * Seeds a SUPERADMIN user in both Supabase Auth and Prisma.
 * Safe to run multiple times — uses upsert / idempotent checks.
 *
 * Run with:
 *   npx ts-node --compiler-options '{"module":"commonjs"}' prisma/seed-superadmin.ts
 */

import { PrismaClient, StaffRole, UserType } from '@prisma/client'
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

// ─── Credentials ─────────────────────────────────────────────────────────────

const EMAIL     = 'k230691@nu.edu.pk'
const PASSWORD  = 'admin'
const FULL_NAME = 'Abdullah Azhar Khan'
const NU_ID     = '23K-0691'
const ROLE      = StaffRole.SUPERADMIN

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🌱 Seeding super-admin...\n')

    // 1. Check if a Prisma user with this email already exists
    const existing = await prisma.user.findUnique({ where: { email: EMAIL } })

    let supabaseId: string

    if (existing) {
        console.log(`ℹ️  Prisma user already exists (id: ${existing.id}) — skipping Supabase creation.`)
        supabaseId = existing.id
    } else {
        // 2. Create in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email:         EMAIL,
            password:      PASSWORD,
            email_confirm: true,
            app_metadata:  { role: ROLE },
            user_metadata: { full_name: FULL_NAME, role: ROLE, nu_id: NU_ID },
        })

        if (error || !data.user) {
            // If the user already exists in Supabase, fetch their ID
            if (error?.message?.toLowerCase().includes('already')) {
                const { data: list } = await supabaseAdmin.auth.admin.listUsers()
                const found = list?.users.find((u) => u.email === EMAIL)
                if (!found) throw new Error(`Supabase error and user not found: ${error?.message}`)
                console.log(`ℹ️  Supabase user already exists (id: ${found.id}).`)
                supabaseId = found.id
            } else {
                throw new Error(`Supabase createUser failed: ${error?.message}`)
            }
        } else {
            supabaseId = data.user.id
            console.log(`✅ Supabase Auth user created (id: ${supabaseId})`)
        }

        // 3. Create in Prisma
        await prisma.user.upsert({
            where:  { id: supabaseId },
            create: {
                id:       supabaseId,
                email:    EMAIL,
                type:     UserType.STAFF,
                isActive: true,
            },
            update: { email: EMAIL, isActive: true },
        })

        await prisma.staffProfile.upsert({
            where:  { id: supabaseId },
            create: {
                id:         supabaseId,
                fullName:   FULL_NAME,
                nuId:       NU_ID,
                staffRole:  ROLE,
                isApproved: true,
                approvedAt: new Date(),
            },
            update: {
                fullName:   FULL_NAME,
                staffRole:  ROLE,
                isApproved: true,
            },
        })
    }

    // Always ensure the staffProfile is up-to-date
    await prisma.staffProfile.upsert({
        where:  { id: supabaseId },
        create: {
            id:         supabaseId,
            fullName:   FULL_NAME,
            nuId:       NU_ID,
            staffRole:  ROLE,
            isApproved: true,
            approvedAt: new Date(),
        },
        update: {
            fullName:   FULL_NAME,
            staffRole:  ROLE,
            isApproved: true,
        },
    })

    console.log(`\n✅ Super-admin seeded successfully.`)
    console.log(`   Email    : ${EMAIL}`)
    console.log(`   Password : ${PASSWORD}`)
    console.log(`   Full Name: ${FULL_NAME}`)
    console.log(`   NU ID    : ${NU_ID}`)
    console.log(`   Role     : ${ROLE}`)
}

main()
    .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1) })
    .finally(() => prisma.$disconnect())
