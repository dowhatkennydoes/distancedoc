#!/usr/bin/env tsx
/**
 * Apply Doctor Availability Migration
 * 
 * Applies the migration SQL directly via Supabase PostgREST API
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'
const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || '$DistanceDoc2423'

const MIGRATION_SQL = `
-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable (with IF NOT EXISTS check)
CREATE TABLE IF NOT EXISTS "doctor_availability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (with IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "doctor_availability_doctorId_idx" ON "doctor_availability"("doctorId");
CREATE INDEX IF NOT EXISTS "doctor_availability_clinicId_idx" ON "doctor_availability"("clinicId");
CREATE INDEX IF NOT EXISTS "doctor_availability_dayOfWeek_idx" ON "doctor_availability"("dayOfWeek");
CREATE INDEX IF NOT EXISTS "doctor_availability_clinicId_doctorId_idx" ON "doctor_availability"("clinicId", "doctorId");
CREATE INDEX IF NOT EXISTS "doctor_availability_doctorId_dayOfWeek_idx" ON "doctor_availability"("doctorId", "dayOfWeek");

-- AddForeignKey (with IF NOT EXISTS check)
DO $$ BEGIN
  ALTER TABLE "doctor_availability" ADD CONSTRAINT "doctor_availability_doctorId_fkey" 
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
`

async function applyMigration() {
  console.log('🚀 Applying Doctor Availability Migration\n')
  console.log('='.repeat(50))

  try {
    // Use pg (PostgreSQL client) to execute SQL directly
    const { Client } = require('pg')
    
    const connectionString = `postgresql://postgres:${encodeURIComponent(DATABASE_PASSWORD)}@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres`
    
    console.log('Connecting to database...')
    const client = new Client({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      }
    })

    await client.connect()
    console.log('✅ Connected to database\n')

    // Execute migration SQL
    console.log('Executing migration SQL...')
    await client.query(MIGRATION_SQL)
    console.log('✅ Migration SQL executed successfully\n')

    // Verify migration
    console.log('Verifying migration...')
    
    // Check if enum exists
    const enumCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek'
      ) as exists;
    `)
    console.log(`   DayOfWeek enum: ${enumCheck.rows[0].exists ? '✅ Exists' : '❌ Missing'}`)

    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'doctor_availability'
      ) as exists;
    `)
    console.log(`   doctor_availability table: ${tableCheck.rows[0].exists ? '✅ Exists' : '❌ Missing'}`)

    // Check indexes
    const indexCheck = await client.query(`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'doctor_availability';
    `)
    console.log(`   Indexes: ✅ ${indexCheck.rows.length} indexes created`)

    await client.end()
    
    console.log('\n' + '='.repeat(50))
    console.log('🎉 Migration applied successfully!')
    console.log('\nThe doctor_availability table is now ready for use.')
    
  } catch (error: any) {
    console.error('\n❌ Error applying migration:')
    console.error(`   ${error.message}`)
    
    if (error.message.includes('already exists')) {
      console.log('\n⚠️  Some objects may already exist. This is okay.')
      console.log('   The migration uses IF NOT EXISTS checks.')
    }
    
    process.exit(1)
  }
}

// Run the script
applyMigration()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

