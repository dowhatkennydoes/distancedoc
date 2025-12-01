#!/usr/bin/env tsx
/**
 * Apply Doctor Availability Migration via Connection Pooler
 * 
 * Uses Supabase connection pooler URL with password
 */

import { Client } from 'pg'

const DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || '$DistanceDoc2423'
const POOLER_URL = `postgresql://postgres.vhwvejtjrajjsluutrqv:${encodeURIComponent(DATABASE_PASSWORD)}@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true`

const MIGRATION_SQL = `
-- CreateEnum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') THEN
    CREATE TYPE "DayOfWeek" AS ENUM (
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
    );
    RAISE NOTICE 'DayOfWeek enum created';
  ELSE
    RAISE NOTICE 'DayOfWeek enum already exists';
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "doctor_availability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "doctor_availability_doctorId_idx" 
  ON "doctor_availability"("doctorId");
CREATE INDEX IF NOT EXISTS "doctor_availability_clinicId_idx" 
  ON "doctor_availability"("clinicId");
CREATE INDEX IF NOT EXISTS "doctor_availability_dayOfWeek_idx" 
  ON "doctor_availability"("dayOfWeek");
CREATE INDEX IF NOT EXISTS "doctor_availability_clinicId_doctorId_idx" 
  ON "doctor_availability"("clinicId", "doctorId");
CREATE INDEX IF NOT EXISTS "doctor_availability_doctorId_dayOfWeek_idx" 
  ON "doctor_availability"("doctorId", "dayOfWeek");

-- AddForeignKey
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_availability_doctorId_fkey'
  ) THEN
    ALTER TABLE "doctor_availability" 
    ADD CONSTRAINT "doctor_availability_doctorId_fkey" 
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddTrigger
CREATE OR REPLACE FUNCTION update_doctor_availability_updated_at()
RETURNS TRIGGER AS $$ 
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_doctor_availability_updated_at_trigger 
  ON "doctor_availability";

CREATE TRIGGER update_doctor_availability_updated_at_trigger
  BEFORE UPDATE ON "doctor_availability"
  FOR EACH ROW
  EXECUTE FUNCTION update_doctor_availability_updated_at();
`

async function applyMigration() {
  console.log('🚀 Applying Doctor Availability Migration via Connection Pooler\n')
  console.log('='.repeat(50))

  const client = new Client({
    connectionString: POOLER_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  })

  try {
    console.log('Connecting to database via connection pooler...')
    await client.connect()
    console.log('✅ Connected successfully\n')

    console.log('Executing migration SQL...')
    await client.query(MIGRATION_SQL)
    console.log('✅ Migration SQL executed\n')

    // Verify
    console.log('Verifying migration...')
    
    const enumCheck = await client.query(`
      SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') as exists;
    `)
    console.log(`   DayOfWeek enum: ${enumCheck.rows[0].exists ? '✅' : '❌'}`)

    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'doctor_availability'
      ) as exists;
    `)
    console.log(`   doctor_availability table: ${tableCheck.rows[0].exists ? '✅' : '❌'}`)

    const indexCount = await client.query(`
      SELECT COUNT(*) as count 
      FROM pg_indexes 
      WHERE tablename = 'doctor_availability';
    `)
    console.log(`   Indexes: ✅ ${indexCount.rows[0].count} created`)

    await client.end()

    console.log('\n' + '='.repeat(50))
    console.log('🎉 Migration applied successfully!')
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    
    if (error.message.includes('pgbouncer')) {
      console.log('\n💡 Note: Connection pooler may not support all DDL operations.')
      console.log('   Please apply migration via Supabase Dashboard SQL Editor instead.')
    }
    
    process.exit(1)
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

