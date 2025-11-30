// TODO: User login endpoint
// TODO: Authenticate with Supabase
// TODO: Return user session and role information
// TODO: Check doctor approval status

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { sanitizeEmail } from '@/lib/security/sanitize'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logInfo, logError as secureLogError, logAudit } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { logLoginSuccess, logLoginFailure, getRequestFromNextRequest } from '@/lib/security/event-logging'
import { v4 as uuidv4 } from 'uuid'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function POST(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    const body = await request.json()
    
    // Sanitize email input
    const sanitizedEmail = sanitizeEmail(body.email)
    if (!sanitizedEmail) {
      return addSecurityHeaders(apiError('Invalid email format', 400))
    }
    
    // Rate limiting: 5 login attempts per minute
    const rateLimitResponse = await firestoreRateLimiters.login(request, sanitizedEmail)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }
    
    const data = loginSchema.parse({ ...body, email: sanitizedEmail })

    const supabase = await createClient()

    // Sign in with Supabase
    const {
      data: authData,
      error: authError,
    } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (authError || !authData.user) {
      // Log login failure with PHI-safe logging (non-blocking)
      logLoginFailure(
        data.email, // Will be automatically masked
        authError?.message || 'Invalid credentials',
        getRequestFromNextRequest(request),
        requestId
      ).catch(err => console.error('Failed to log login failure:', err))
      return addSecurityHeaders(apiError('Invalid email or password', 401))
    }

    // Get user role and approval status with full metadata
    const { data: userMetadata, error: roleError } = await supabase
      .from('user_roles')
      .select('role, doctor_id, patient_id, approved, clinic_id')
      .eq('user_id', authData.user.id)
      .single()

    if (roleError || !userMetadata) {
      return apiError('User role not found', 500)
    }

    const roleData = userMetadata as {
      role: string | null
      doctor_id: string | null
      patient_id: string | null
      approved: boolean | null
      clinic_id: string | null
    }

    const role = (roleData.role as 'doctor' | 'patient' | 'admin') || 'patient'
    const approved = roleData.approved || false
    const clinicId = roleData.clinic_id || 'default-clinic'

    // Build full user object matching AuthUser format
    const fullUser = {
      id: authData.user.id,
      email: authData.user.email!,
      role,
      emailVerified: authData.user.email_confirmed_at !== null,
      clinicId,
      metadata: {
        doctorId: roleData.doctor_id || undefined,
        patientId: roleData.patient_id || undefined,
        approved,
      },
    }

    // Check if doctor is approved
    if (role === 'doctor' && !approved) {
      // Log login success (pending approval) - non-blocking
      logLoginSuccess(
        authData.user.id,
        role,
        getRequestFromNextRequest(request),
        requestId
      ).catch(err => console.error('Failed to log login success:', err))
      const response = apiSuccess(
        {
          user: fullUser,
          message: 'Account pending admin approval',
        },
        200
      )
      return addSecurityHeaders(response)
    }

    // Log successful login - non-blocking
    logLoginSuccess(
      authData.user.id,
      role,
      getRequestFromNextRequest(request),
      requestId
    ).catch(err => console.error('Failed to log login success:', err))
    logInfo('User logged in', { userId: authData.user.id, role }, authData.user.id, requestId)
    
    const response = apiSuccess({
      user: fullUser,
      session: authData.session,
    })
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Login failed', undefined, requestId))
  }
}

