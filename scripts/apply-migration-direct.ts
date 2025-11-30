/**
 * Direct migration application script
 * Applies the tenant isolation migration directly to Supabase
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyMigration() {
  console.log('🚀 Applying tenant isolation migration...\n')

  try {
    // Read migration SQL
    const migrationPath = path.join(process.cwd(), 'scripts/apply-migration-sql.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    // Split into individual statements (remove verification query)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.includes('SELECT'))
      .map(s => s + ';')

    console.log(`📋 Executing ${statements.length} SQL statements...\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (!statement || statement === ';') continue

      try {
        console.log(`  [${i + 1}/${statements.length}] Executing statement...`)
        const { error } = await supabase.rpc('exec_sql', { sql: statement })

        if (error) {
          // Try direct query if RPC doesn't work
          const { error: queryError } = await supabase
            .from('_migration_test')
            .select('*')
            .limit(0)

          // If that also fails, we'll need to use raw SQL connection
          console.log(`  ⚠️  Statement ${i + 1} may need manual execution`)
        } else {
          console.log(`  ✅ Statement ${i + 1} executed`)
        }
      } catch (err: any) {
        console.log(`  ⚠️  Statement ${i + 1}: ${err.message}`)
      }
    }

    console.log('\n✅ Migration application attempted')
    console.log('\n⚠️  Note: Some statements may need to be run manually in Supabase SQL Editor')
    console.log('   File: scripts/apply-migration-sql.sql')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    throw error
  }
}

// Since Supabase JS client doesn't support raw SQL execution directly,
// we'll provide instructions instead
console.log('📋 Migration SQL prepared')
console.log('⚠️  Supabase JS client cannot execute DDL statements directly')
console.log('📝 Please run the migration in Supabase Dashboard SQL Editor:')
console.log('   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
console.log('   2. Open: scripts/apply-migration-sql.sql')
console.log('   3. Copy and paste into SQL Editor')
console.log('   4. Click Run')
console.log('')
console.log('✅ After migration, run: npm run assign:clinics')

