#!/usr/bin/env tsx
/**
 * Apply Doctor Dashboard Preview Migration
 * 
 * This script applies the migration for the doctor_dashboard_preview table
 * using the Supabase connection pooler.
 * 
 * Usage:
 *   npx tsx scripts/apply-dashboard-preview-migration.ts
 * 
 * Environment Variables Required:
 *   - DATABASE_URL (should use pooler URL)
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
  console.error('   Please set it in your .env.local file')
  process.exit(1)
}

const prisma = new PrismaClient()

async function applyMigration() {
  console.log('🔄 Applying Doctor Dashboard Preview Migration')
  console.log('='.repeat(50))

  try {
    // Read the migration SQL file
    const migrationPath = path.join(
      process.cwd(),
      'prisma/migrations/add_doctor_dashboard_preview/migration.sql'
    )

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`)
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('\n📝 Executing migration SQL...')

    // Execute the migration SQL
    await prisma.$executeRawUnsafe(migrationSQL)

    console.log('\n✅ Migration applied successfully!')
    console.log('\n📊 Verifying table creation...')

    // Verify the table was created
    const tableExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'doctor_dashboard_preview'
      );
    `)

    if (tableExists[0]?.exists) {
      console.log('✅ Table "doctor_dashboard_preview" exists')
    } else {
      console.warn('⚠️  Table "doctor_dashboard_preview" not found')
    }

    // Count existing records
    const count = await prisma.doctorDashboardPreview.count()
    console.log(`📈 Current preview records: ${count}`)

    console.log('\n' + '='.repeat(50))
    console.log('🎉 Migration complete!')
    console.log('\nYou can now run the seed script:')
    console.log('  npx tsx scripts/seedDoctors.ts')

  } catch (error: any) {
    console.error('\n❌ Error applying migration:')
    console.error(`   ${error.message}`)

    if (error.message.includes('already exists')) {
      console.log('\n💡 The table may already exist. This is safe to ignore.')
    } else {
      console.error('\n📋 Full error:')
      console.error(error)
      process.exit(1)
    }
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

