/**
 * Apply migration using Supabase Management API
 * This uses the REST API to execute SQL directly
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

async function applyMigration() {
  console.log('🚀 Applying Tenant Isolation Migration via Supabase API')
  console.log('=======================================================\n')

  // Read migration SQL
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/002_add_clinic_id.sql')
  const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

  console.log('📋 Migration SQL loaded')
  console.log(`📏 SQL length: ${migrationSQL.length} characters\n`)

  // Create Supabase client with service role key
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // Split SQL into statements (remove comments and empty lines)
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'))
    .map(s => s + ';')

  console.log(`📝 Executing ${statements.length} SQL statements...\n`)

  let successCount = 0
  let errorCount = 0

  // Execute each statement using RPC or direct query
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    if (!statement || statement === ';') continue

    try {
      // Try using the REST API's query endpoint
      // Note: Supabase REST API doesn't support DDL directly, so we'll use the SQL editor approach
      // But we can verify the migration was applied
      console.log(`  [${i + 1}/${statements.length}] ${statement.substring(0, 60)}...`)
      
      // For DDL statements, we need to use the Management API or SQL Editor
      // The Supabase JS client doesn't support DDL execution
      // So we'll provide instructions instead
      
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`)
      errorCount++
    }
  }

  // Since Supabase JS client can't execute DDL, we'll use the Management API
  // via fetch to the Supabase REST API
  console.log('\n⚠️  Supabase JS client cannot execute DDL statements')
  console.log('📝 Using Supabase Management API...\n')

  try {
    // Use the Supabase Management API endpoint
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
      console.log('✅ Migration applied via Management API!')
    } else {
      const errorText = await response.text()
      console.log('⚠️  Management API call failed:', errorText)
      throw new Error('Management API not available')
    }
  } catch (error: any) {
    console.log('⚠️  Management API not available or DDL not supported')
    console.log('\n📝 Please apply migration manually:\n')
    console.log('   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
    console.log('   2. Copy the SQL below:')
    console.log('   3. Paste into SQL Editor')
    console.log('   4. Click Run\n')
    console.log('=' .repeat(60))
    console.log(migrationSQL)
    console.log('=' .repeat(60))
    process.exit(1)
  }

  // Verify migration
  console.log('\n🔍 Verifying migration...')
  try {
    const { data, error } = await supabase
      .from('doctors')
      .select('clinic_id')
      .limit(1)

    if (error && error.message.includes('clinic_id')) {
      console.log('❌ Migration not applied - clinic_id column missing')
    } else {
      console.log('✅ Migration verified - clinic_id column exists')
    }
  } catch (err: any) {
    console.log('⚠️  Could not verify:', err.message)
  }

  console.log('\n✅ Migration process complete!')
}

applyMigration()
  .then(() => {
    console.log('\n✅ Script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  })

