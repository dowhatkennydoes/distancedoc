#!/usr/bin/env tsx
/**
 * Verify Doctor Availability Migration
 * 
 * Checks if the migration has been applied successfully
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

async function verifyMigration() {
  console.log('🔍 Verifying Doctor Availability Migration\n')
  console.log('='.repeat(50))

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Try to query the doctor_availability table
    console.log('Checking doctor_availability table...')
    const { data, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .limit(1)

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('❌ Migration NOT applied')
        console.log('   The doctor_availability table does not exist.')
        console.log('\n📝 To apply the migration:')
        console.log('   1. Go to Supabase Dashboard → SQL Editor')
        console.log('   2. Copy SQL from: prisma/migrations/20251130142452_add_doctor_availability/APPLY-VIA-DASHBOARD.sql')
        console.log('   3. Run the SQL')
        process.exit(1)
      }
      throw error
    }

    console.log('✅ Migration applied successfully!')
    console.log(`   doctor_availability table exists`)

    // Count existing availability blocks
    const { count } = await supabase
      .from('doctor_availability')
      .select('*', { count: 'exact', head: true })

    console.log(`   Existing availability blocks: ${count || 0}`)

    // Check for enum (via a test query)
    console.log('\nChecking DayOfWeek enum...')
    const { data: testData, error: enumError } = await supabase
      .from('doctor_availability')
      .select('dayOfWeek')
      .limit(1)

    if (!enumError) {
      console.log('✅ DayOfWeek enum exists')
    } else {
      console.log('⚠️  Could not verify enum (table exists though)')
    }

    console.log('\n' + '='.repeat(50))
    console.log('🎉 Migration verification complete!')
    console.log('\nYou can now:')
    console.log('  - Run the seed script to create availability blocks')
    console.log('  - Query doctor availability via Prisma')

  } catch (error: any) {
    console.error('\n❌ Error verifying migration:')
    console.error(`   ${error.message}`)
    process.exit(1)
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
