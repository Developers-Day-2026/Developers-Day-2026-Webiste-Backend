/**
 * Full reset script:
 *  1. Delete every Supabase auth user
 *  2. Truncate all Prisma-managed tables (via db push --force-reset)
 *  3. Re-seed
 *
 * Run: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/reset.ts
 */

import { createClient } from '@supabase/supabase-js'
import { execSync }     from 'child_process'
import dotenv           from 'dotenv'

dotenv.config()

const supabaseUrl        = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SECRET_API_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌  SUPABASE_URL or SECRET_API_KEY missing from .env')
    process.exit(1)
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
})

async function deleteAllSupabaseUsers() {
    console.log('\n🗑️  Deleting all Supabase auth users...')

    let deleted = 0
    let page    = 1

    while (true) {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })

        if (error) {
            console.error('   ❌  listUsers error:', error.message)
            break
        }

        const users = data?.users ?? []
        if (users.length === 0) break

        for (const user of users) {
            const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id)
            if (delErr) {
                console.warn(`   ⚠️  Could not delete ${user.email}: ${delErr.message}`)
            } else {
                deleted++
            }
        }

        // If fewer than 1000 came back, we're on the last page
        if (users.length < 1000) break
        page++
    }

    console.log(`   ✓ ${deleted} Supabase auth users deleted`)
}

async function resetDatabase() {
    console.log('\n💾  Resetting Prisma database (db push --force-reset)...')
    execSync('npx prisma db push --force-reset', { stdio: 'inherit' })
    console.log('   ✓ Database reset complete')
}

async function seedDatabase() {
    console.log('\n🌱  Re-seeding database...')
    execSync('npx ts-node --compiler-options \'{"module":"CommonJS"}\' prisma/seed.ts', { stdio: 'inherit' })
}

;(async () => {
    try {
        await deleteAllSupabaseUsers()
        await resetDatabase()
        await seedDatabase()
        console.log('\n✅  Full reset complete.\n')
    } catch (err) {
        console.error('\n❌  Reset failed:', err)
        process.exit(1)
    }
})()
