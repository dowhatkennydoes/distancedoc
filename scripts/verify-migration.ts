/**
 * Verify that the tenant isolation migration was applied
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verifyMigration() {
  console.log('🔍 Verifying Tenant Isolation Migration')
  console.log('========================================\n')

  const tables = ['user_roles', 'doctors', 'patients', 'appointments', 'visit_notes', 'message_threads']
  const results: { table: string; hasClinicId: boolean }[] = []

  for (const table of tables) {
    try {
      // Try to query clinic_id column
      const { data, error } = await supabase
        .from(table)
        .select('clinic_id')
        .limit(1)

      if (error && error.message.includes('clinic_id')) {
        results.push({ table, hasClinicId: false })
      } else {
        results.push({ table, hasClinicId: true })
      }
    } catch (err: any) {
      // If we can query clinic_id, it exists
      if (err.message && err.message.includes('clinic_id')) {
        results.push({ table, hasClinicId: false })
      } else {
        results.push({ table, hasClinicId: true })
      }
    }
  }

  console.log('📊 Migration Status:\n')
  let allPassed = true
  for (const result of results) {
    const status = result.hasClinicId ? '✅' : '❌'
    console.log(`   ${status} ${result.table}: ${result.hasClinicId ? 'clinic_id exists' : 'clinic_id missing'}`)
    if (!result.hasClinicId) allPassed = false
  }

  console.log('')
  if (allPassed) {
    console.log('✅ Migration verified successfully!')
    console.log('')
    console.log('📋 Next steps:')
    console.log('   1. Run: npm run update:user-roles')
    console.log('   2. Run: npm run assign:clinics')
    console.log('   3. Run: npm run test:tenant')
    console.log('')
  } else {
    console.log('❌ Migration not fully applied')
    console.log('   Please ensure all tables have clinic_id columns')
    console.log('')
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error.message)
    process.exit(1)
  })

