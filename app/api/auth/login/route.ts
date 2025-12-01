/**
 * Login Route with Proper Cookie Handling
 * 
 * Ensures:
 * - signInWithPassword correctly sets session cookie
 * - Access token stored in httpOnly cookie
 * - Refresh token stored correctly
 * - Session persists on page reload
 */

import { NextRequest, NextResponse } from 'next/server'
import { signInWithPassword, createRouteHandlerClient } from '@/lib/auth/supabase'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { sanitizeEmail } from '@/lib/security/sanitize'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logInfo } from '@/lib/security/logging'
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
      return addSecurityHeaders(apiError('Invalid email format', 400, requestId))
    }
    
    // Rate limiting: 5 login attempts per minute
    const rateLimitResponse = await firestoreRateLimiters.login(request, sanitizedEmail)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }
    
    const data = loginSchema.parse({ ...body, email: sanitizedEmail })

    // Sign in with password - this will properly set cookies
    const {
      user: authUser,
      session,
      error: authError,
      response: authResponse,
    } = await signInWithPassword(request, data.email, data.password)

    if (authError || !authUser || !session) {
      // Log login failure with PHI-safe logging (non-blocking)
      logLoginFailure(
        data.email, // Will be automatically masked
        authError?.message || 'Invalid credentials',
        getRequestFromNextRequest(request),
        requestId
      ).catch(err => console.error('Failed to log login failure:', err))
      return addSecurityHeaders(apiError('Invalid email or password', 401, requestId))
    }

    // Get Supabase client to fetch user role
    const { supabase } = createRouteHandlerClient(request)

    // Get user role and approval status with full metadata
    // Database column is camelCase (clinicId)
    const { data: userMetadata, error: roleError } = await supabase
      .from('user_roles')
      .select('role, doctor_id, patient_id, approved, clinicId')
      .eq('user_id', authUser.id)
      .single()

    if (roleError || !userMetadata) {
      return addSecurityHeaders(apiError('User role not found', 500, requestId))
    }

    const roleData = userMetadata as {
      role: string | null
      doctor_id: string | null
      patient_id: string | null
      approved: boolean | null
      clinicId: string | null
      clinic_id?: string | null // Handle both for compatibility
    }

    const role = (roleData.role as 'doctor' | 'patient' | 'admin') || 'patient'
    const approved = roleData.approved || false
    // Handle both camelCase and snake_case for compatibility
    const clinicId = roleData.clinicId || roleData.clinic_id || 'default-clinic'

    // Build full user object matching AuthUser format
    const fullUser = {
      id: authUser.id,
      email: authUser.email!,
      role,
      emailVerified: authUser.email_confirmed_at !== null,
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
        authUser.id,
        role,
        getRequestFromNextRequest(request),
        requestId
      ).catch(err => console.error('Failed to log login success:', err))
      
      // Return response with proper cookies set
      const response = apiSuccess(
        {
          user: fullUser,
          message: 'Account pending admin approval',
        },
        200,
        requestId
      )
      
      // Merge cookies from auth response
      authResponse.cookies.getAll().forEach(cookie => {
        response.cookies.set(cookie.name, cookie.value, {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: cookie.name.includes('refresh') ? 60 * 60 * 24 * 7 : 60 * 60, // 7 days for refresh, 1 hour for access
        })
      })
      
      return addSecurityHeaders(response)
    }

    // Log successful login - non-blocking
    logLoginSuccess(
      authUser.id,
      role,
      getRequestFromNextRequest(request),
      requestId
    ).catch(err => console.error('Failed to log login success:', err))
    logInfo('User logged in', { userId: authUser.id, role }, authUser.id, requestId)
    
    // Return response with user data and proper cookies
    const response = apiSuccess({
      user: fullUser,
      message: 'Login successful',
    }, 200, requestId)
    
    // Merge cookies from auth response (contains access_token and refresh_token in httpOnly cookies)
    authResponse.cookies.getAll().forEach(cookie => {
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: cookie.name.includes('refresh') ? 60 * 60 * 24 * 7 : 60 * 60, // 7 days for refresh, 1 hour for access
      })
    })
    
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Login failed', undefined, requestId))
  }
}

