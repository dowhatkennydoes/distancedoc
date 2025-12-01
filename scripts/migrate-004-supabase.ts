#!/usr/bin/env tsx

/**
 * Apply Migration 004: Doctor Dashboard Preview
 * Using Supabase client with direct SQL execution
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables  
dotenv.config({ path: '.env.local' })

const supabaseUrl = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function applyMigration() {
  try {
    console.log('🚀 Applying Doctor Dashboard Preview Migration...')
    
    // Check if table already exists
    console.log('🔍 Checking if table already exists...')
    
    const { data: existingTable, error: checkError } = await supabase
      .from('doctor_dashboard_preview')
      .select('id')
      .limit(1)

    if (!checkError) {
      console.log('✅ Table already exists! Migration may have been applied.')
      console.log(`📊 Found ${existingTable.length} existing records`)
      return
    }

    if (!checkError.message.includes('does not exist')) {
      console.error('❌ Unexpected error checking table:', checkError)
      throw checkError
    }

    console.log('📄 Table does not exist. Reading migration SQL...')
    
    // Read migration file
    const migrationSQL = readFileSync('supabase/migrations/004_add_doctor_dashboard_preview.sql', 'utf8')
    
    console.log('📝 Migration SQL read successfully')
    console.log('\n⚠️  Note: Supabase JS client cannot execute DDL statements directly.')
    console.log('📋 Please copy and execute the following SQL in Supabase Dashboard:')
    console.log('🌐 Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
    console.log('\n' + '='.repeat(80))
    console.log('-- COPY AND PASTE THE FOLLOWING SQL:')
    console.log('='.repeat(80))
    console.log(migrationSQL)
    console.log('='.repeat(80))
    console.log('\n📌 After executing in Dashboard, run this script again to verify.')

  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

applyMigration()