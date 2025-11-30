// TODO: User login endpoint
// TODO: Authenticate with Supabase
// TODO: Return user session and role information
// TODO: Check doctor approval status

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { rateLimiters } from '@/lib/security/rate-limit'
import { sanitizeEmail } from '@/lib/security/sanitize'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logInfo, logError as secureLogError, logAudit } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { v4 as uuidv4 } from 'uuid'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

export async function POST(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimiters.auth(request)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }
    
    const body = await request.json()
    
    // Sanitize email input
    const sanitizedEmail = sanitizeEmail(body.email)
    if (!sanitizedEmail) {
      return addSecurityHeaders(apiError('Invalid email format', 400))
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
      logAudit('LOGIN_ATTEMPT', 'user', data.email, 'anonymous', false, { requestId })
      return addSecurityHeaders(apiError('Invalid email or password', 401))
    }

    // Get user role and approval status
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role, approved')
      .eq('user_id', authData.user.id)
      .single()

    if (roleError || !userRole) {
      return apiError('User role not found', 500)
    }

    // Check if doctor is approved
    if (userRole.role === 'doctor' && !userRole.approved) {
      logAudit('LOGIN_SUCCESS', 'user', authData.user.id, authData.user.id, true, { 
        requestId,
        role: userRole.role,
        approved: false 
      })
      const response = apiSuccess(
        {
          user: {
            id: authData.user.id,
            email: authData.user.email,
            role: userRole.role,
            approved: false,
          },
          message: 'Account pending admin approval',
        },
        200
      )
      return addSecurityHeaders(response)
    }

    logAudit('LOGIN_SUCCESS', 'user', authData.user.id, authData.user.id, true, { 
      requestId,
      role: userRole.role 
    })
    logInfo('User logged in', { userId: authData.user.id, role: userRole.role }, authData.user.id, requestId)
    
    const response = apiSuccess({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userRole.role,
        approved: userRole.approved,
      },
      session: authData.session,
    })
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Login failed', undefined, requestId))
  }
}

