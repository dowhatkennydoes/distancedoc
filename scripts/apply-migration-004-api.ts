#!/usr/bin/env tsx

/**
 * Apply Migration 004 via Supabase REST API
 * Uses the sql endpoint to execute the migration
 */

import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load environment variables  
dotenv.config({ path: '.env.local' })

const supabaseUrl = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

async function executeMigration() {
  try {
    console.log('🚀 Applying Migration 004 via Supabase REST API...')
    
    // Read the migration SQL
    const migrationSQL = readFileSync('supabase/migrations/004_add_doctor_dashboard_preview.sql', 'utf8')
    
    console.log('📄 Migration SQL loaded')
    console.log('🔗 Connecting to Supabase REST API...')
    
    // Execute via the SQL API endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: migrationSQL
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', response.status, errorText)
      
      if (response.status === 404) {
        console.log('\n💡 The SQL RPC endpoint might not be available.')
        console.log('📝 Fallback: Use Supabase Dashboard SQL Editor')
        console.log('🌐 URL: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
        return false
      }
      
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    const result = await response.text()
    console.log('✅ Migration executed successfully!')
    console.log('📊 Result:', result || 'No output')

    return true

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message)
    
    console.log('\n📝 Fallback: Manual execution required')
    console.log('🌐 Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
    console.log('📋 Copy and paste the migration SQL from:')
    console.log('   supabase/migrations/004_add_doctor_dashboard_preview.sql')
    
    return false
  }
}

// Also try the PostgreSQL REST interface
async function tryPostgRESTApproach() {
  try {
    console.log('\n🔄 Trying alternative approach via PostgREST...')
    
    const migrationSQL = readFileSync('supabase/migrations/004_add_doctor_dashboard_preview.sql', 'utf8')
    
    // Break the migration into smaller parts that might work
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS "doctor_dashboard_preview" (
          "id" TEXT NOT NULL,
          "doctorId" TEXT NOT NULL,
          "clinicId" TEXT NOT NULL,
          "totalPatients" INTEGER NOT NULL DEFAULT 0,
          "upcomingAppointments" INTEGER NOT NULL DEFAULT 0,
          "unresolvedMessages" INTEGER NOT NULL DEFAULT 0,
          "pendingLabs" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "doctor_dashboard_preview_pkey" PRIMARY KEY ("id")
      );
    `

    console.log('📋 Attempting to create table via SQL function...')
    
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
      body: JSON.stringify({
        query: createTableSQL
      })
    })

    if (!response.ok) {
      console.log('⚠️  PostgREST approach also not available')
      return false
    }

    const result = await response.json()
    console.log('✅ PostgREST execution successful:', result)
    return true

  } catch (error: any) {
    console.log('⚠️  PostgREST approach failed:', error.message)
    return false
  }
}

async function main() {
  console.log('🔧 Migration 004: Doctor Dashboard Preview')
  console.log('=' .repeat(50))
  
  // Try REST API approach first
  const apiSuccess = await executeMigration()
  
  if (!apiSuccess) {
    // Try PostgREST approach
    const postgrestSuccess = await tryPostgRESTApproach()
    
    if (!postgrestSuccess) {
      console.log('\n❌ Automated approaches failed')
      console.log('\n📝 MANUAL EXECUTION REQUIRED:')
      console.log('1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
      console.log('2. Copy the SQL from: supabase/migrations/004_add_doctor_dashboard_preview.sql')
      console.log('3. Paste and run in SQL Editor')
      console.log('4. Run verification: npx tsx scripts/verify-migration-004.ts')
    }
  }

  console.log('\n' + '='.repeat(50))
  console.log('🎯 Migration process complete')
}

main()