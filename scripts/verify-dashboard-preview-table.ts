#!/usr/bin/env tsx
/**
 * Verify Doctor Dashboard Preview Table
 * 
 * Checks if the doctor_dashboard_preview table exists and shows its structure.
 * 
 * Usage:
 *   npx tsx scripts/verify-dashboard-preview-table.ts
 */

import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
}
dotenv.config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('❌ Missing required environment variable: DATABASE_URL')
  process.exit(1)
}

const prisma = new PrismaClient()

async function verifyTable() {
  console.log('🔍 Verifying Doctor Dashboard Preview Table')
  console.log('='.repeat(50))

  try {
    // Check if table exists
    const tableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'doctor_dashboard_preview'
      ) as exists;
    `)

    if (!tableExists[0]?.exists) {
      console.log('\n❌ Table "doctor_dashboard_preview" does NOT exist')
      console.log('\n💡 Please apply the migration first:')
      console.log('   1. Go to Supabase Dashboard > SQL Editor')
      console.log('   2. Run: prisma/migrations/add_doctor_dashboard_preview/APPLY-VIA-DASHBOARD.sql')
      console.log('   OR run: npx tsx scripts/apply-dashboard-preview-migration.ts')
      process.exit(1)
    }

    console.log('✅ Table "doctor_dashboard_preview" exists')

    // Get table columns
    const columns = await prisma.$queryRawUnsafe<Array<{
      column_name: string
      data_type: string
      is_nullable: string
    }>>(`
      SELECT 
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'doctor_dashboard_preview'
      ORDER BY ordinal_position;
    `)

    console.log('\n📊 Table Structure:')
    console.log('─'.repeat(50))
    columns.forEach((col) => {
      console.log(`   ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`)
    })

    // Check indexes
    const indexes = await prisma.$queryRawUnsafe<Array<{
      indexname: string
      indexdef: string
    }>>(`
      SELECT 
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'doctor_dashboard_preview'
      ORDER BY indexname;
    `)

    console.log('\n🔍 Indexes:')
    console.log('─'.repeat(50))
    indexes.forEach((idx) => {
      console.log(`   ${idx.indexname}`)
    })

    // Count records
    const count = await prisma.doctorDashboardPreview.count()
    console.log(`\n📈 Total Records: ${count}`)

    if (count > 0) {
      // Show sample data
      const samples = await prisma.doctorDashboardPreview.findMany({
        take: 5,
        include: {
          doctor: {
            select: {
              specialization: true,
            },
          },
        },
      })

      console.log('\n📋 Sample Records:')
      console.log('─'.repeat(50))
      samples.forEach((preview) => {
        console.log(`\n   Doctor: ${preview.doctor.specialization || 'N/A'}`)
        console.log(`   - Total Patients: ${preview.totalPatients}`)
        console.log(`   - Upcoming Appointments: ${preview.upcomingAppointments}`)
        console.log(`   - Unresolved Messages: ${preview.unresolvedMessages}`)
        console.log(`   - Pending Labs: ${preview.pendingLabs}`)
      })
    }

    console.log('\n' + '='.repeat(50))
    console.log('✅ Verification complete!')

  } catch (error: any) {
    console.error('\n❌ Error during verification:')
    console.error(`   ${error.message}`)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

