// TODO: Patient and doctor signup endpoints
// TODO: Patients can self-register
// TODO: Doctors require admin approval (approved = false initially)
// TODO: Create user in Supabase Auth
// TODO: Create user role record in database
// TODO: Create doctor/patient profile in Prisma

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/db/prisma'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['doctor', 'patient']),
  // Doctor fields
  licenseNumber: z.string().optional(),
  npiNumber: z.string().optional(),
  specialization: z.string().optional(),
  // Patient fields
  dateOfBirth: z.string().optional(),
  phoneNumber: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = signupSchema.parse(body)

    const supabase = await createClient()

    // Create user in Supabase Auth
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          role: data.role,
        },
      },
    })

    if (authError || !authData.user) {
      return apiError(authError?.message || 'Failed to create user', 400)
    }

    // Create user role record in Supabase
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: data.role,
        approved: data.role === 'patient', // Patients auto-approved, doctors need approval
      })

    if (roleError) {
      // Rollback: delete auth user if role creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      return apiError('Failed to create user role', 500)
    }

    // Create profile in Prisma database
    if (data.role === 'doctor') {
      if (!data.licenseNumber) {
        return apiError('License number is required for doctors', 400)
      }

      await prisma.doctor.create({
        data: {
          userId: authData.user.id,
          licenseNumber: data.licenseNumber,
          npiNumber: data.npiNumber,
          specialization: data.specialization,
        },
      })
    } else if (data.role === 'patient') {
      if (!data.dateOfBirth) {
        return apiError('Date of birth is required for patients', 400)
      }

      await prisma.patient.create({
        data: {
          userId: authData.user.id,
          dateOfBirth: new Date(data.dateOfBirth),
          phoneNumber: data.phoneNumber,
        },
      })
    }

    return apiSuccess({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: data.role,
        approved: data.role === 'patient',
      },
      message:
        data.role === 'doctor'
          ? 'Account created. Pending admin approval.'
          : 'Account created successfully.',
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError(error.errors[0].message, 400)
    }
    return apiError(error.message || 'Internal server error', 500)
  }
}

