/**
 * Apply migration using Supabase Management API
 * Attempts to use the SQL execution endpoint
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

async function applyMigration() {
  console.log('🚀 Applying Migration via Supabase Management API')
  console.log('==================================================\n')

  // Read migration SQL
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/002_add_clinic_id.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📋 Migration SQL loaded\n')

  // Try using the Supabase Management API
  // Note: This requires the project to have SQL execution enabled via API
  try {
    // Use the Supabase Management API endpoint for SQL execution
    // This endpoint may not be available in all Supabase projects
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ query: migrationSQL })
    })

    if (response.ok) {
      console.log('✅ Migration applied via Management API!')
      return
    } else {
      const errorText = await response.text()
      console.log('⚠️  Management API error:', errorText)
    }
  } catch (error: any) {
    console.log('⚠️  Management API not available:', error.message)
  }

  // Alternative: Try using Supabase JS client with raw SQL
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Split SQL into individual statements
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && !s.toLowerCase().includes('select'))
    .map(s => s + ';')

  console.log(`📝 Attempting to execute ${statements.length} statements...\n`)

  // Since Supabase JS client can't execute DDL, we need to use the Dashboard
  console.log('⚠️  Supabase JS client cannot execute DDL statements')
  console.log('📝 Migration must be applied via Supabase Dashboard\n')
  console.log('📋 Quick Steps:')
  console.log('   1. Open: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
  console.log('   2. Copy the SQL below:')
  console.log('   3. Paste into SQL Editor')
  console.log('   4. Click Run\n')
  console.log('=' .repeat(70))
  console.log(migrationSQL)
  console.log('=' .repeat(70))
  console.log('')

  process.exit(1)
}

applyMigration()
  .then(() => {
    console.log('✅ Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Error:', error.message)
    process.exit(1)
  })

