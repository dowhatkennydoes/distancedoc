/**
 * Apply migration using Supabase REST API with service role
 * This attempts to use the SQL execution endpoint directly
 */

import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

async function applyMigration() {
  console.log('🚀 Applying Migration via Supabase API')
  console.log('=======================================\n')

  const migrationPath = path.join(process.cwd(), 'supabase/migrations/002_add_clinic_id.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📋 Attempting to execute migration via API...\n')

  // Try Supabase Management API SQL endpoint
  // Note: This endpoint may require special permissions
  try {
    // Method 1: Try the SQL execution endpoint (if available)
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: migrationSQL })
    })

    if (response.ok) {
      console.log('✅ Migration applied!')
      return
    }

    const error = await response.json()
    console.log('⚠️  API endpoint not available:', error.message || error)
  } catch (error: any) {
    console.log('⚠️  API call failed:', error.message)
  }

  // Method 2: Try using Supabase CLI programmatically
  console.log('\n📝 Supabase API cannot execute DDL statements')
  console.log('   This is a security restriction by Supabase\n')
  console.log('✅ Solution: Manual application (2 minutes)\n')
  console.log('   1. Open: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
  console.log('   2. Copy the SQL below')
  console.log('   3. Paste and Run\n')
  console.log('=' .repeat(70))
  console.log(migrationSQL)
  console.log('=' .repeat(70))

  process.exit(1)
}

applyMigration().catch(console.error)

