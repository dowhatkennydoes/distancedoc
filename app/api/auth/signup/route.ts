/**
 * Signup Route with Proper Cookie Handling
 * 
 * Ensures:
 * - signUp correctly sets session cookie if auto-confirm is enabled
 * - Access token stored in httpOnly cookie when session is created
 * - Refresh token stored correctly
 */

import { NextRequest, NextResponse } from 'next/server'
import { signUp, createRouteHandlerClient } from '@/lib/auth/supabase'
import { prisma } from '@/db/prisma'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { addSecurityHeaders } from '@/lib/security/headers'
import { sanitizeEmail } from '@/lib/security/sanitize'

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
    
    // Sanitize email
    const sanitizedEmail = sanitizeEmail(body.email)
    if (!sanitizedEmail) {
      return addSecurityHeaders(apiError('Invalid email format', 400))
    }
    
    const data = signupSchema.parse({ ...body, email: sanitizedEmail })

    // Sign up with Supabase - this will properly set cookies if session is created
    const {
      user: authUser,
      session,
      error: authError,
      response: authResponse,
    } = await signUp(request, data.email, data.password, {
      data: {
        role: data.role,
      },
    })

    if (authError || !authUser) {
      return addSecurityHeaders(apiError(authError?.message || 'Failed to create user', 400))
    }

    // Get Supabase client to create user role
    const { supabase } = createRouteHandlerClient(request)

    // Create user role record in Supabase
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authUser.id,
        role: data.role,
        approved: data.role === 'patient', // Patients auto-approved, doctors need approval
      })

    if (roleError) {
      // Rollback: delete auth user if role creation fails
      await supabase.auth.admin.deleteUser(authUser.id).catch(() => {
        // Ignore errors during rollback
      })
      return addSecurityHeaders(apiError('Failed to create user role', 500))
    }

    // Create profile in Prisma database
    if (data.role === 'doctor') {
      if (!data.licenseNumber) {
        return addSecurityHeaders(apiError('License number is required for doctors', 400))
      }

      await prisma.doctor.create({
        data: {
          userId: authUser.id,
          clinicId: 'default-clinic', // Required field for tenant isolation
          licenseNumber: data.licenseNumber,
          npiNumber: data.npiNumber,
          specialization: data.specialization,
        },
      })
    } else if (data.role === 'patient') {
      if (!data.dateOfBirth) {
        return addSecurityHeaders(apiError('Date of birth is required for patients', 400))
      }

      await prisma.patient.create({
        data: {
          userId: authUser.id,
          clinicId: 'default-clinic', // Required field for tenant isolation
          firstName: 'New', // Required field - should be collected in signup form
          lastName: 'Patient', // Required field - should be collected in signup form
          sex: 'unknown', // Required field - should be collected in signup form
          dateOfBirth: new Date(data.dateOfBirth),
          phone: data.phoneNumber,
        },
      })
    }

    // Return response with proper cookies if session was created
    const response = apiSuccess({
      user: {
        id: authUser.id,
        email: authUser.email,
        role: data.role,
        approved: data.role === 'patient',
      },
      message:
        data.role === 'doctor'
          ? 'Account created. Pending admin approval.'
          : 'Account created successfully.',
    }, 200)

    // If session was created (auto-confirm enabled), merge cookies
    if (session) {
      authResponse.cookies.getAll().forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: cookie.name.includes('refresh') ? 60 * 60 * 24 * 7 : 60 * 60,
        })
      })
    }

    return addSecurityHeaders(response)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return addSecurityHeaders(apiError(error.errors[0].message, 400))
    }
    return addSecurityHeaders(apiError(error.message || 'Internal server error', 500))
  }
}

