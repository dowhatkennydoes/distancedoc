/**
 * Script to assign clinic IDs to existing records
 * 
 * This script assigns clinic IDs to all existing records in the database.
 * Run this after applying the migration to ensure all records have clinic IDs.
 * 
 * Usage:
 *   npx tsx scripts/assign-clinic-ids.ts [clinic-id]
 * 
 * If no clinic-id is provided, defaults to 'default-clinic'
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignClinicIds(clinicId: string = 'default-clinic') {
  console.log(`Assigning clinic ID: ${clinicId}`)
  console.log('Starting clinic ID assignment...\n')

  try {
    // 1. Get all users and assign clinic IDs based on their user_roles
    console.log('1. Updating user_roles with clinic IDs...')
    const { prisma: prismaDb } = await import('@/db/prisma')
    
    // Note: user_roles is in Supabase, not Prisma
    // This would need to be done via Supabase SQL or API
    console.log('   ⚠️  user_roles table is in Supabase - update via SQL:')
    console.log(`   UPDATE user_roles SET clinic_id = '${clinicId}' WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';`)
    console.log('')

    // 2. Update doctors
    console.log('2. Updating doctors with clinic IDs...')
    const doctorsUpdated = await prisma.doctor.updateMany({
      where: {
        OR: [
          { clinicId: null as any },
          { clinicId: 'default-clinic' },
        ],
      },
      data: {
        clinicId,
      },
    })
    console.log(`   ✅ Updated ${doctorsUpdated.count} doctors`)

    // 3. Update patients
    console.log('3. Updating patients with clinic IDs...')
    const patientsUpdated = await prisma.patient.updateMany({
      where: {
        OR: [
          { clinicId: null as any },
          { clinicId: 'default-clinic' },
        ],
      },
      data: {
        clinicId,
      },
    })
    console.log(`   ✅ Updated ${patientsUpdated.count} patients`)

    // 4. Update appointments
    console.log('4. Updating appointments with clinic IDs...')
    // Get all appointments and update based on their doctor's clinic
    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { clinicId: null as any },
          { clinicId: 'default-clinic' },
        ],
      },
      include: {
        doctor: {
          select: { clinicId: true },
        },
      },
    })

    let appointmentsUpdated = 0
    for (const appointment of appointments) {
      const appointmentClinicId = appointment.doctor.clinicId || clinicId
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { clinicId: appointmentClinicId },
      })
      appointmentsUpdated++
    }
    console.log(`   ✅ Updated ${appointmentsUpdated} appointments`)

    // 5. Update visit notes
    console.log('5. Updating visit notes with clinic IDs...')
    const visitNotes = await prisma.visitNote.findMany({
      where: {
        OR: [
          { clinicId: null as any },
          { clinicId: 'default-clinic' },
        ],
      },
      include: {
        doctor: {
          select: { clinicId: true },
        },
      },
    })

    let visitNotesUpdated = 0
    for (const visitNote of visitNotes) {
      const visitNoteClinicId = visitNote.doctor.clinicId || clinicId
      await prisma.visitNote.update({
        where: { id: visitNote.id },
        data: { clinicId: visitNoteClinicId },
      })
      visitNotesUpdated++
    }
    console.log(`   ✅ Updated ${visitNotesUpdated} visit notes`)

    // 6. Update message threads
    console.log('6. Updating message threads with clinic IDs...')
    const messageThreads = await prisma.messageThread.findMany({
      where: {
        OR: [
          { clinicId: null as any },
          { clinicId: 'default-clinic' },
        ],
      },
      include: {
        doctor: {
          select: { clinicId: true },
        },
      },
    })

    let messageThreadsUpdated = 0
    for (const thread of messageThreads) {
      const threadClinicId = thread.doctor.clinicId || clinicId
      await prisma.messageThread.update({
        where: { id: thread.id },
        data: { clinicId: threadClinicId },
      })
      messageThreadsUpdated++
    }
    console.log(`   ✅ Updated ${messageThreadsUpdated} message threads`)

    console.log('\n✅ Clinic ID assignment complete!')
    console.log(`\nSummary:`)
    console.log(`  - Doctors: ${doctorsUpdated.count}`)
    console.log(`  - Patients: ${patientsUpdated.count}`)
    console.log(`  - Appointments: ${appointmentsUpdated}`)
    console.log(`  - Visit Notes: ${visitNotesUpdated}`)
    console.log(`  - Message Threads: ${messageThreadsUpdated}`)
    console.log(`\n⚠️  Remember to update user_roles table in Supabase:`)
    console.log(`   UPDATE user_roles SET clinic_id = '${clinicId}' WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';`)

  } catch (error) {
    console.error('❌ Error assigning clinic IDs:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Get clinic ID from command line or use default
const clinicId = process.argv[2] || 'default-clinic'

assignClinicIds(clinicId)
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

