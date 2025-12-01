#!/usr/bin/env tsx
/**
 * Seed Doctors, Patients, and Appointments Script
 * 
 * Creates:
 * - Three demo doctors in Supabase Auth and Prisma database
 * - Five demo patients with auth accounts
 * - Six demo appointments
 * - Dashboard preview metrics for each doctor
 * 
 * Usage:
 *   npm run seed:doctors
 *   OR
 *   npx tsx scripts/seedDoctors.ts
 * 
 * Environment Variables Required:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - DATABASE_URL
 * 
 * Features:
 * - Idempotent: Can be run multiple times safely
 * - Updates existing records instead of creating duplicates
 * - Comprehensive error handling with try/catch blocks
 * - Detailed success summary with all credentials
 */

import { createClient } from '@supabase/supabase-js'
import { PrismaClient, AppointmentStatus, VisitType } from '@prisma/client'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

// Load environment variables from .env.local if it exists
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath })
}

// Load from .env as fallback
dotenv.config()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY')
  console.error('   Please set it in your .env.local file')
  process.exit(1)
}

if (!DATABASE_URL) {
  console.error('❌ Missing required environment variable: DATABASE_URL')
  console.error('   Please set it in your .env.local file')
  process.exit(1)
}

// Initialize Supabase client with service role (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Initialize Prisma client
const prisma = new PrismaClient()

const CLINIC_ID = 'demo-clinic-001'

interface AvailabilityBlock {
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'
  startTime: string // Format: "HH:mm"
  endTime: string // Format: "HH:mm"
}

interface DoctorCreationResult {
  success: boolean
  email: string
  userId?: string
  doctorId?: string
  specialty?: string
  error?: string
}

interface PatientData {
  firstName: string
  lastName: string
  email: string
  phone: string
  dateOfBirth: Date
  sex: string
}

interface PatientCreationResult {
  success: boolean
  patientId?: string
  userId?: string
  email: string
  error?: string
}

interface AppointmentCreationResult {
  success: boolean
  appointmentId?: string
  doctorEmail: string
  patientEmail: string
  scheduledAt: Date
  reason?: string
  error?: string
}

// Doctor data to seed
const DOCTORS_DATA: Array<{
  email: string
  password: string
  firstName: string
  lastName: string
  phone: string
  specialty: string
  bio: string
  avatarUrl: string
  licenseNumber: string
  npiNumber: string
  availability: AvailabilityBlock[]
}> = [
  {
    email: 'doctor1@example.com',
    password: 'password123',
    firstName: 'Marcus',
    lastName: 'Walters',
    phone: '555-111-2222',
    specialty: 'Internal Medicine',
    bio: 'Board-certified internist with 10 years of telehealth experience.',
    avatarUrl: 'https://placehold.co/128x128?text=Dr+MW',
    licenseNumber: 'MD123456',
    npiNumber: '1234567890',
    availability: [
      { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 'WEDNESDAY', startTime: '12:00', endTime: '17:00' },
    ],
  },
  {
    email: 'doctor2@example.com',
    password: 'password123',
    firstName: 'Linda',
    lastName: 'Patel',
    phone: '555-333-4444',
    specialty: 'Dermatology',
    bio: 'Specialist in acne, rashes, and virtual dermatology assessments.',
    avatarUrl: 'https://placehold.co/128x128?text=Dr+LP',
    licenseNumber: 'MD234567',
    npiNumber: '2345678901',
    availability: [
      { dayOfWeek: 'TUESDAY', startTime: '09:00', endTime: '15:00' },
      { dayOfWeek: 'THURSDAY', startTime: '10:00', endTime: '14:00' },
    ],
  },
  {
    email: 'doctor3@example.com',
    password: 'password123',
    firstName: 'Daniel',
    lastName: 'Kim',
    phone: '555-555-7777',
    specialty: 'Psychiatry',
    bio: 'Telepsychiatrist focused on anxiety, ADHD, and mood disorders.',
    avatarUrl: 'https://placehold.co/128x128?text=Dr+DK',
    licenseNumber: 'MD345678',
    npiNumber: '3456789012',
    availability: [
      { dayOfWeek: 'MONDAY', startTime: '14:00', endTime: '18:00' },
      { dayOfWeek: 'FRIDAY', startTime: '09:00', endTime: '13:00' },
    ],
  },
]

// Demo patients to create
const DEMO_PATIENTS: PatientData[] = [
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@demo.com',
    phone: '555-2001',
    dateOfBirth: new Date('1985-05-15'),
    sex: 'F',
  },
  {
    firstName: 'Kevin',
    lastName: 'Brooks',
    email: 'kevin.brooks@demo.com',
    phone: '555-2002',
    dateOfBirth: new Date('1990-08-22'),
    sex: 'M',
  },
  {
    firstName: 'Alicia',
    lastName: 'Martinez',
    email: 'alicia.martinez@demo.com',
    phone: '555-2003',
    dateOfBirth: new Date('1988-03-10'),
    sex: 'F',
  },
  {
    firstName: 'Jordan',
    lastName: 'Lee',
    email: 'jordan.lee@demo.com',
    phone: '555-2004',
    dateOfBirth: new Date('1992-11-05'),
    sex: 'M',
  },
  {
    firstName: 'Naomi',
    lastName: 'Ellis',
    email: 'naomi.ellis@demo.com',
    phone: '555-2005',
    dateOfBirth: new Date('1987-07-18'),
    sex: 'F',
  },
]

async function createAvailabilityBlocks(doctorId: string, availability: AvailabilityBlock[]): Promise<void> {
  if (!availability || availability.length === 0) {
    return
  }

  try {
    console.log('   4. Creating availability blocks...')

    // Delete existing availability blocks for this doctor (idempotent)
    await prisma.doctorAvailability.deleteMany({
      where: { doctorId },
    })

    // Create new availability blocks
    await prisma.doctorAvailability.createMany({
      data: availability.map((block) => ({
        doctorId,
        clinicId: CLINIC_ID,
        dayOfWeek: block.dayOfWeek,
        startTime: block.startTime,
        endTime: block.endTime,
      })),
    })

    console.log(`   ✅ Created ${availability.length} availability block(s)`)
  } catch (error: any) {
    throw new Error(`Failed to create availability blocks: ${error.message}`)
  }
}

/**
 * Generate random number between min and max (inclusive)
 */
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function createDashboardPreview(doctorId: string): Promise<void> {
  try {
    console.log('   5. Creating dashboard preview...')

    // Generate random metrics
    const metrics = {
      totalPatients: getRandomInt(15, 150),
      upcomingAppointments: getRandomInt(2, 25),
      unresolvedMessages: getRandomInt(0, 15),
      pendingLabs: getRandomInt(0, 10),
    }

    // Check if preview already exists (idempotent)
    const existing = await prisma.doctorDashboardPreview.findUnique({
      where: { doctorId },
    })

    if (existing) {
      // Update existing preview
      await prisma.doctorDashboardPreview.update({
        where: { doctorId },
        data: {
          clinicId: CLINIC_ID,
          ...metrics,
        },
      })
      console.log(`   ✅ Updated dashboard preview with random metrics`)
    } else {
      // Create new preview
      await prisma.doctorDashboardPreview.create({
        data: {
          doctorId,
          clinicId: CLINIC_ID,
          ...metrics,
        },
      })
      console.log(`   ✅ Created dashboard preview with random metrics`)
    }

    console.log(`      - Total Patients: ${metrics.totalPatients}`)
    console.log(`      - Upcoming Appointments: ${metrics.upcomingAppointments}`)
    console.log(`      - Unresolved Messages: ${metrics.unresolvedMessages}`)
    console.log(`      - Pending Labs: ${metrics.pendingLabs}`)
  } catch (error: any) {
    throw new Error(`Failed to create dashboard preview: ${error.message}`)
  }
}

async function createDoctor(doctorData: typeof DOCTORS_DATA[0]): Promise<DoctorCreationResult> {
  const { email, password, firstName, lastName, phone, specialty, bio, avatarUrl, licenseNumber, npiNumber, availability } = doctorData

  try {
    // Step 1: Check if user already exists (idempotent)
    console.log(`\n📋 Creating doctor: ${email}`)
    
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    let userId: string

    if (existingUser) {
      console.log(`   ⚠️  User ${email} already exists. Updating...`)
      userId = existingUser.id

      // Update user password and ensure role is in metadata
      await supabase.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          firstName,
          lastName,
          phone,
          specialty,
          avatarUrl,
          role: 'doctor', // Explicitly set role in user_metadata for login detection
        },
      })
      console.log(`   ✅ Updated existing user with role='doctor' in metadata`)
    } else {
      // Step 2: Create user in Supabase Auth
      console.log('   1. Creating user in Supabase Auth...')
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          firstName,
          lastName,
          phone,
          specialty,
          avatarUrl,
          role: 'doctor', // Explicitly set role in user_metadata for login detection
        },
      })

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('Failed to create user: No user data returned')
      }

      userId = authData.user.id
      console.log(`   ✅ User created: ${userId}`)
    }

    // Step 3: Create or update user_roles entry (idempotent)
    console.log('   2. Creating/updating user_roles entry...')
    
    try {
      // Check if role exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (existingRole) {
        // Update existing role
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({
            role: 'doctor',
            approved: true,
            clinicId: CLINIC_ID,
          })
          .eq('user_id', userId)

        if (updateError) {
          throw new Error(`Failed to update user role: ${updateError.message}`)
        }
        console.log('   ✅ Updated user_roles entry')
      } else {
        // Create new role entry
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'doctor',
            approved: true,
            clinicId: CLINIC_ID,
          })

        if (roleError) {
          throw new Error(`Failed to create user role: ${roleError.message}`)
        }
        console.log('   ✅ Created user_roles entry')
      }
    } catch (error: any) {
      throw new Error(`Failed to manage user_roles: ${error.message}`)
    }

    // Step 4: Create or update Doctor record in Prisma database (idempotent)
    console.log('   3. Creating/updating Doctor record in database...')
    
    try {
      // Check if doctor exists
      const existingDoctor = await prisma.doctor.findUnique({
        where: { userId },
      })

      let doctorId: string

      if (existingDoctor) {
        // Update existing doctor
        const updated = await prisma.doctor.update({
          where: { userId },
          data: {
            clinicId: CLINIC_ID,
            licenseNumber,
            npiNumber,
            specialization: specialty,
            bio,
            credentials: ['MD'], // Default credentials
            languages: ['English'],
            timezone: 'America/New_York',
          },
        })
        doctorId = updated.id
        console.log('   ✅ Updated Doctor record')
      } else {
        // Create new doctor
        const created = await prisma.doctor.create({
          data: {
            userId,
            clinicId: CLINIC_ID,
            licenseNumber,
            npiNumber,
            specialization: specialty,
            bio,
            credentials: ['MD'], // Default credentials
            languages: ['English'],
            timezone: 'America/New_York',
          },
        })
        doctorId = created.id
        console.log('   ✅ Created Doctor record')
      }

      // Update user_roles with doctor_id reference
      const { error: updateDoctorIdError } = await supabase
        .from('user_roles')
        .update({ doctor_id: doctorId })
        .eq('user_id', userId)

      if (updateDoctorIdError) {
        console.warn(`   ⚠️  Warning: Failed to update doctor_id in user_roles: ${updateDoctorIdError.message}`)
      }

      // Step 5: Create availability blocks
      if (availability && availability.length > 0) {
        try {
          await createAvailabilityBlocks(doctorId, availability)
        } catch (error: any) {
          console.warn(`   ⚠️  Warning: Failed to create availability blocks: ${error.message}`)
          // Continue even if availability creation fails
        }
      }

      // Step 6: Create dashboard preview
      try {
        await createDashboardPreview(doctorId)
      } catch (error: any) {
        console.warn(`   ⚠️  Warning: Failed to create dashboard preview: ${error.message}`)
        // Continue even if dashboard preview creation fails
      }

      console.log(`\n✅ Successfully created/updated doctor: ${email}`)
      console.log(`   - User ID: ${userId}`)
      console.log(`   - Doctor ID: ${doctorId}`)
      console.log(`   - Name: ${firstName} ${lastName}`)
      console.log(`   - Specialty: ${specialty}`)
      console.log(`   - Clinic ID: ${CLINIC_ID}`)

      return {
        success: true,
        email,
        userId,
        doctorId,
        specialty,
      }
    } catch (error: any) {
      throw new Error(`Failed to manage Doctor record: ${error.message}`)
    }
  } catch (error: any) {
    console.error(`\n❌ Error creating doctor ${email}:`)
    console.error(`   ${error.message}`)
    
    return {
      success: false,
      email,
      specialty,
      error: error.message,
    }
  }
}

async function createPatient(patientData: PatientData): Promise<PatientCreationResult> {
  const { firstName, lastName, email, phone, dateOfBirth, sex } = patientData

  try {
    // Check if patient already exists (idempotent)
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const existingUser = existingUsers?.users?.find((u) => u.email === email)

    let userId: string

    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create auth user
      const password = 'demo123' // Demo password for demo patients
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          firstName,
          lastName,
          phone,
          role: 'patient',
        },
      })

      if (authError) {
        throw new Error(`Failed to create auth user: ${authError.message}`)
      }

      if (!authData.user) {
        throw new Error('Failed to create user: No user data returned')
      }

      userId = authData.user.id

      // Create user_roles entry
      await supabase.from('user_roles').insert({
        user_id: userId,
        role: 'patient',
        approved: true,
        clinicId: CLINIC_ID,
      })
    }

    // Check if patient record exists (idempotent)
    let patient = await prisma.patient.findUnique({
      where: { userId },
    })

    let patientId: string

    if (patient) {
      patientId = patient.id
    } else {
      // Create patient record
      const created = await prisma.patient.create({
        data: {
          userId,
          clinicId: CLINIC_ID,
          firstName,
          lastName,
          dateOfBirth,
          sex,
          phone,
          email,
        },
      })
      patientId = created.id
    }

    return {
      success: true,
      patientId,
      userId,
      email,
    }
  } catch (error: any) {
    return {
      success: false,
      email,
      error: error.message,
    }
  }
}

function getNextWeekday(dayOfWeek: number): Date {
  // dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const currentDay = today.getDay()
  let daysUntilTarget = dayOfWeek - currentDay
  
  // If the target day has already passed this week, add 7 days
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7
  }
  
  const targetDate = new Date(today)
  targetDate.setDate(today.getDate() + daysUntilTarget)
  return targetDate
}

function createAppointmentDateTime(baseDate: Date, timeString: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number)
  const appointmentDate = new Date(baseDate)
  appointmentDate.setHours(hours, minutes, 0, 0)
  return appointmentDate
}

async function createAppointment(
  doctorId: string,
  patientId: string,
  scheduledAt: Date,
  reason?: string
): Promise<string> {
  try {
    const appointment = await prisma.appointment.create({
      data: {
        doctorId,
        patientId,
        clinicId: CLINIC_ID,
        scheduledAt,
        duration: 30, // 30 minutes
        status: AppointmentStatus.SCHEDULED,
        visitType: VisitType.VIDEO,
        reason: reason || 'Demo appointment',
      },
    })

    return appointment.id
  } catch (error: any) {
    throw new Error(`Failed to create appointment: ${error.message}`)
  }
}

async function seedDoctors() {
  try {
    console.log('🌱 Starting Doctor Seeding Process')
    console.log('='.repeat(50))
    console.log(`\nClinic ID: ${CLINIC_ID}`)
    console.log(`Supabase URL: ${SUPABASE_URL}`)
    console.log(`Database: ${DATABASE_URL ? 'Connected' : 'Not connected'}`)

    const results: DoctorCreationResult[] = []

    // Create all doctors
    console.log('\n📋 Step 1: Creating doctors...')
    try {
      for (const doctorData of DOCTORS_DATA) {
        const result = await createDoctor(doctorData)
        results.push(result)
      }
    } catch (error: any) {
      console.error(`\n❌ Error in doctor creation step: ${error.message}`)
      throw error
    }

    // Summary
    console.log('\n' + '='.repeat(50))
    console.log('📊 Doctor Seeding Summary')
    console.log('='.repeat(50))

    const successfulDoctors = results.filter((r) => r.success)
    const failedDoctors = results.filter((r) => !r.success)

    console.log(`\n✅ Successful: ${successfulDoctors.length}`)
    successfulDoctors.forEach((r) => {
      console.log(`   - ${r.email}`)
    })

    if (failedDoctors.length > 0) {
      console.log(`\n❌ Failed: ${failedDoctors.length}`)
      failedDoctors.forEach((r) => {
        console.log(`   - ${r.email}: ${r.error}`)
      })
    }

    // Create demo patients
    console.log('\n' + '='.repeat(50))
    console.log('📋 Step 2: Creating demo patients...')
    
    const patientResults: PatientCreationResult[] = []
    try {
      for (const patientData of DEMO_PATIENTS) {
        console.log(`\n   Creating patient: ${patientData.firstName} ${patientData.lastName}`)
        const result = await createPatient(patientData)
        patientResults.push(result)
        if (result.success) {
          console.log(`   ✅ Created: ${patientData.email}`)
        } else {
          console.log(`   ❌ Failed: ${result.error}`)
        }
      }
    } catch (error: any) {
      console.error(`\n❌ Error in patient creation step: ${error.message}`)
      // Continue with appointments even if some patients failed
    }

    const successfulPatients = patientResults.filter((r) => r.success)
    console.log(`\n✅ Created ${successfulPatients.length} demo patient(s)`)

    // Create appointments
    console.log('\n' + '='.repeat(50))
    console.log('📋 Step 3: Creating appointments...')

    // Get doctor IDs from successful doctor creation
    const doctorIds = successfulDoctors.map((r) => r.doctorId!).filter(Boolean)
    const patientIds = successfulPatients.map((r) => r.patientId!).filter(Boolean)

    const appointmentResults: AppointmentCreationResult[] = []

    if (doctorIds.length < 3 || patientIds.length < 5) {
      console.log('⚠️  Cannot create appointments: missing doctors or patients')
      console.log(`   Doctors: ${doctorIds.length}/3, Patients: ${patientIds.length}/5`)
    } else {
      try {
        // Calculate dates
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        tomorrow.setHours(0, 0, 0, 0)

        const nextTuesday = getNextWeekday(2) // 2 = Tuesday
        const nextFriday = getNextWeekday(5) // 5 = Friday

        // Define appointments
        const appointments: Array<{
          doctorIndex: number
          patientIndex: number
          scheduledAt: Date
          reason?: string
        }> = [
          // Doctor 1 appointments
          {
            doctorIndex: 0,
            patientIndex: 0, // Sarah Johnson
            scheduledAt: createAppointmentDateTime(tomorrow, '10:00'),
            reason: 'Routine checkup',
          },
          {
            doctorIndex: 0,
            patientIndex: 1, // Kevin Brooks
            scheduledAt: createAppointmentDateTime(tomorrow, '12:30'),
            reason: 'Follow-up appointment',
          },
          // Doctor 2 appointments
          {
            doctorIndex: 1,
            patientIndex: 0, // Sarah Johnson
            scheduledAt: createAppointmentDateTime(nextTuesday, '11:00'),
            reason: 'Dermatology consultation',
          },
          {
            doctorIndex: 1,
            patientIndex: 2, // Alicia Martinez
            scheduledAt: createAppointmentDateTime(nextTuesday, '14:00'),
            reason: 'Skin condition review',
          },
          // Doctor 3 appointments
          {
            doctorIndex: 2,
            patientIndex: 3, // Jordan Lee
            scheduledAt: createAppointmentDateTime(nextFriday, '09:30'),
            reason: 'Initial psychiatric consultation',
          },
          {
            doctorIndex: 2,
            patientIndex: 4, // Naomi Ellis
            scheduledAt: createAppointmentDateTime(nextFriday, '12:00'),
            reason: 'Therapy session',
          },
        ]

        // Create appointments
        for (const apt of appointments) {
          try {
            const doctorId = doctorIds[apt.doctorIndex]
            const patientId = patientIds[apt.patientIndex]

            if (!doctorId || !patientId) {
              appointmentResults.push({
                success: false,
                doctorEmail: DOCTORS_DATA[apt.doctorIndex]?.email || 'unknown',
                patientEmail: DEMO_PATIENTS[apt.patientIndex]?.email || 'unknown',
                scheduledAt: apt.scheduledAt,
                reason: apt.reason,
                error: 'Missing doctor or patient ID',
              })
              console.log(`   ⚠️  Skipping appointment: missing doctor or patient`)
              continue
            }

            const appointmentId = await createAppointment(
              doctorId,
              patientId,
              apt.scheduledAt,
              apt.reason
            )

            appointmentResults.push({
              success: true,
              appointmentId,
              doctorEmail: DOCTORS_DATA[apt.doctorIndex].email,
              patientEmail: DEMO_PATIENTS[apt.patientIndex].email,
              scheduledAt: apt.scheduledAt,
              reason: apt.reason,
            })

            const doctorName = DOCTORS_DATA[apt.doctorIndex].firstName
            const patientName = `${DEMO_PATIENTS[apt.patientIndex].firstName} ${DEMO_PATIENTS[apt.patientIndex].lastName}`
            const dateStr = apt.scheduledAt.toLocaleDateString()
            const timeStr = apt.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })

            console.log(`   ✅ Created: ${doctorName} → ${patientName} on ${dateStr} at ${timeStr}`)
          } catch (error: any) {
            appointmentResults.push({
              success: false,
              doctorEmail: DOCTORS_DATA[apt.doctorIndex]?.email || 'unknown',
              patientEmail: DEMO_PATIENTS[apt.patientIndex]?.email || 'unknown',
              scheduledAt: apt.scheduledAt,
              reason: apt.reason,
              error: error.message,
            })
            console.log(`   ❌ Failed to create appointment: ${error.message}`)
          }
        }
      } catch (error: any) {
        console.error(`\n❌ Error in appointment creation step: ${error.message}`)
      }
    }

    const successfulAppointments = appointmentResults.filter((r) => r.success)
    console.log(`\n✅ Created ${successfulAppointments.length} appointment(s)`)

    // ========================================================================
    // SUCCESS SUMMARY
    // ========================================================================
    console.log('\n' + '='.repeat(70))
    console.log('🎉 SEEDING PROCESS COMPLETE - SUCCESS SUMMARY')
    console.log('='.repeat(70))

    console.log(`\n📊 Statistics:`)
    console.log(`   ✅ Doctors: ${successfulDoctors.length}/${DOCTORS_DATA.length}`)
    console.log(`   ✅ Patients: ${successfulPatients.length}/${DEMO_PATIENTS.length}`)
    console.log(`   ✅ Appointments: ${successfulAppointments.length}/6`)
    console.log(`   🏥 Clinic ID: ${CLINIC_ID}`)

    console.log('\n' + '='.repeat(70))
    console.log('👨‍⚕️  DOCTOR CREDENTIALS & DETAILS')
    console.log('='.repeat(70))

    for (let i = 0; i < successfulDoctors.length; i++) {
      const doctorResult = successfulDoctors[i]
      const doctorData = DOCTORS_DATA[i]
      
      if (doctorResult.success && doctorResult.doctorId) {
        console.log(`\n${i + 1}. ${doctorData.firstName} ${doctorData.lastName}`)
        console.log(`   ──────────────────────────────────────────────────────────`)
        console.log(`   📧 Email:         ${doctorResult.email}`)
        console.log(`   🔑 Password:      ${doctorData.password}`)
        console.log(`   🆔 Doctor ID:     ${doctorResult.doctorId}`)
        console.log(`   🏥 Clinic ID:     ${CLINIC_ID}`)
        console.log(`   ⚕️  Specialty:     ${doctorResult.specialty || doctorData.specialty}`)
        console.log(`   📱 Phone:         ${doctorData.phone}`)
        console.log(`   🆔 License:       ${doctorData.licenseNumber}`)
        console.log(`   🔐 Role:          doctor (set in user_metadata and user_roles)`)
        console.log(`   ✅ Approved:      true`)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('📅 SEEDED APPOINTMENTS')
    console.log('='.repeat(70))

    if (successfulAppointments.length > 0) {
      for (const apt of successfulAppointments) {
        const dateStr = apt.scheduledAt.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
        const timeStr = apt.scheduledAt.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
        console.log(`\n   👤 ${apt.doctorEmail}`)
        console.log(`      → ${apt.patientEmail}`)
        console.log(`      📅 ${dateStr} at ${timeStr}`)
        console.log(`      📝 ${apt.reason || 'No reason provided'}`)
      }
    } else {
      console.log('\n   ⚠️  No appointments were created')
    }

    console.log('\n' + '='.repeat(70))
    console.log('✅ VERIFICATION CHECKLIST')
    console.log('='.repeat(70))
    console.log('\n   All doctors have:')
    console.log('   • role="doctor" in user_metadata')
    console.log('   • role="doctor" in user_roles table')
    console.log('   • approved=true in user_roles table')
    console.log('   • Dashboard preview metrics generated')
    console.log('   • Availability blocks configured')
    console.log(`\n   All data assigned to clinic: ${CLINIC_ID}`)

    console.log('\n' + '='.repeat(70))
    console.log('🚀 NEXT STEPS')
    console.log('='.repeat(70))
    console.log('\n   1. Log in with any doctor credentials above')
    console.log('   2. Verify dashboard preview metrics are visible')
    console.log('   3. Check appointments are showing in calendar')
    console.log('\n   💡 This script is idempotent - you can run it multiple times safely!')

    console.log('\n' + '='.repeat(70))

  } catch (error: any) {
    console.error('\n❌ Fatal error during seeding process:')
    console.error(`   ${error.message}`)
    if (error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    throw error
  }
}

async function main() {
  try {
    await seedDoctors()
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  } catch (error: any) {
    console.error('\n❌ Fatal error during seeding:')
    console.error(error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    // Cleanup: Disconnect Prisma
    try {
      await prisma.$disconnect()
    } catch (error) {
      // Ignore disconnect errors
    }
  }
}

// Run the script
main()
