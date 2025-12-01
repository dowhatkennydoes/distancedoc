#!/usr/bin/env tsx
/**
 * Apply Doctor Availability Migration via Supabase REST API
 * 
 * Uses Supabase REST API to execute SQL statements
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

// SQL statements to execute
const MIGRATION_STEPS = [
  {
    name: 'Create DayOfWeek Enum',
    sql: `
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') THEN
          CREATE TYPE "DayOfWeek" AS ENUM (
            'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
          );
        END IF;
      END $$;
    `,
  },
  {
    name: 'Create doctor_availability table',
    sql: `
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
    `,
  },
  {
    name: 'Create indexes',
    sql: `
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
    `,
  },
  {
    name: 'Add foreign key constraint',
    sql: `
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
    `,
  },
  {
    name: 'Add updatedAt trigger',
    sql: `
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
    `,
  },
]

async function executeSQL(supabase: any, sql: string): Promise<void> {
  // Use rpc to execute SQL - Supabase doesn't have direct SQL execution via REST
  // So we'll use the PostgREST query builder to verify tables exist
  // For actual migration, we need to use psql or Dashboard SQL Editor
  
  console.log('   ⚠️  Direct SQL execution via REST API is not supported.')
  console.log('   Please apply migration via Supabase Dashboard SQL Editor.')
  throw new Error('Direct SQL execution not available via REST API')
}

async function applyMigration() {
  console.log('🚀 Applying Doctor Availability Migration via Supabase\n')
  console.log('='.repeat(50))
  console.log('\n⚠️  Note: Supabase REST API does not support direct SQL execution.')
  console.log('   This script will verify the migration status.')
  console.log('   To apply the migration, use the Supabase Dashboard SQL Editor.\n')

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Check if table exists by trying to query it
    console.log('Checking if migration has been applied...')
    
    const { data, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .limit(0)

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        console.log('\n❌ Migration NOT applied yet')
        console.log('\n📋 To apply the migration:')
        console.log('   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql')
        console.log('   2. Copy SQL from: prisma/migrations/20251130142452_add_doctor_availability/APPLY-VIA-DASHBOARD.sql')
        console.log('   3. Paste and run in SQL Editor\n')
        
        console.log('📄 Migration SQL file location:')
        console.log('   prisma/migrations/20251130142452_add_doctor_availability/APPLY-VIA-DASHBOARD.sql\n')
        
        return
      }
      throw error
    }

    console.log('✅ Migration already applied!')
    console.log('   doctor_availability table exists\n')

    // Count availability blocks
    const { count } = await supabase
      .from('doctor_availability')
      .select('*', { count: 'exact', head: true })

    console.log(`📊 Current status:`)
    console.log(`   - Availability blocks: ${count || 0}`)

  } catch (error: any) {
    if (error.message.includes('does not exist') || error.message.includes('42P01')) {
      console.log('\n❌ Migration NOT applied')
      console.log('\n📋 Apply via Supabase Dashboard:')
      console.log('   1. Go to SQL Editor')
      console.log('   2. Run: prisma/migrations/20251130142452_add_doctor_availability/APPLY-VIA-DASHBOARD.sql\n')
    } else {
      console.error('\n❌ Error:', error.message)
    }
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Verification complete')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Error:', error)
    process.exit(1)
  })

