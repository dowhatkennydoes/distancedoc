/**
 * Auth Me Endpoint - Safe User Status Check
 * 
 * Requirements:
 * 1. Never throw a 500
 * 2. Never send a 401
 * 3. Always return safe JSON structure
 * 4. Wrap all logging in try/catch
 * 5. Wrap all session calls in try/catch
 * 6. Cannot blow up under any circumstance
 * 
 * Returns:
 * - { authenticated: true, user: {...}, role: string, clinicId: string } if authenticated
 * - { authenticated: false, user: null, role: null, clinicId: null } if not authenticated
 */

import { NextRequest, NextResponse } from 'next/server'
import { addSecurityHeaders } from '@/lib/security/headers'

interface AuthMeResponse {
  authenticated: boolean
  user: {
    id: string
    email: string
    role: string
    clinicId: string
  } | null
  role: string | null
  clinicId: string | null
}

/**
 * Safe response helper - always returns unauthenticated response with exact shape
 */
function createUnauthenticatedResponse(): NextResponse {
  const response: AuthMeResponse = {
    authenticated: false,
    user: null,
    role: null,
    clinicId: null,
  }
  
  try {
    return addSecurityHeaders(NextResponse.json(response, { status: 200 }))
  } catch (error) {
    // Even if addSecurityHeaders fails, return basic response
    try {
      return NextResponse.json(response, { status: 200 })
    } catch {
      // Last resort - return minimal valid JSON
      return new NextResponse(
        JSON.stringify(response),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

/**
 * Safe response helper - returns authenticated response
 */
function createAuthenticatedResponse(
  id: string,
  email: string,
  role: string,
  clinicId: string
): NextResponse {
  const response: AuthMeResponse = {
    authenticated: true,
    user: {
      id,
      email,
      role,
      clinicId,
    },
    role,
    clinicId,
  }
  
  try {
    return addSecurityHeaders(NextResponse.json(response, { status: 200 }))
  } catch (error) {
    // Even if addSecurityHeaders fails, return basic response
    try {
      return NextResponse.json(response, { status: 200 })
    } catch {
      // Last resort - return minimal valid JSON
      return new NextResponse(
        JSON.stringify(response),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
  }
}

export async function GET(request: NextRequest) {
  // Outermost try-catch - catches absolutely everything
  try {
    // Initialize variables with safe defaults
    let supabase: any = null
    let session: any = null
    let user: any = null
    let role: string | null = null
    let clinicId: string | null = null

    // Step 1: Create Supabase client - wrapped in try/catch
    try {
      const { createRouteHandlerClient } = await import('@/lib/auth/supabase')
      const clientResult = createRouteHandlerClient(request)
      supabase = clientResult?.supabase || null
    } catch (error) {
      // Log silently and continue
      try {
        const { logWarn } = await import('@/lib/security/logging')
        logWarn(
          'Failed to create route handler client in /api/auth/me',
          { error: 'Client creation error (not exposed to client)' },
          undefined,
          undefined
        )
      } catch {
        // Ignore logging errors - continue to return safe response
      }
      
      // No Supabase client = not authenticated
      return createUnauthenticatedResponse()
    }

    // If no supabase client, return unauthenticated
    if (!supabase) {
      return createUnauthenticatedResponse()
    }

    // Step 2: Get session - wrapped in try/catch
    try {
      const sessionResult = await supabase.auth.getSession()
      
      // Handle both direct result and nested data
      if (sessionResult?.data?.session) {
        session = sessionResult.data.session
      } else if (sessionResult?.session) {
        session = sessionResult.session
      } else {
        session = null
      }

      // Log session errors silently if any
      if (sessionResult?.error) {
        try {
          const { logWarn } = await import('@/lib/security/logging')
          logWarn(
            'Session check failed in /api/auth/me',
            { error: 'Session error (not exposed to client)' },
            undefined,
            undefined
          )
        } catch {
          // Ignore logging errors
        }
      }
    } catch (error) {
      // Log silently and continue
      try {
        const { logWarn } = await import('@/lib/security/logging')
        logWarn(
          'Session check exception in /api/auth/me',
          { error: 'Session exception (not exposed to client)' },
          undefined,
          undefined
        )
      } catch {
        // Ignore logging errors
      }
      
      // Session check failed = not authenticated
      return createUnauthenticatedResponse()
    }

    // If no session, return unauthenticated
    if (!session) {
      return createUnauthenticatedResponse()
    }

    // Step 3: Get user - wrapped in try/catch
    try {
      const userResult = await supabase.auth.getUser()
      
      // Handle both direct result and nested data
      if (userResult?.data?.user) {
        user = userResult.data.user
      } else if (userResult?.user) {
        user = userResult.user
      } else {
        user = null
      }

      // Log user errors silently if any
      if (userResult?.error) {
        try {
          const { logWarn } = await import('@/lib/security/logging')
          logWarn(
            'User check failed in /api/auth/me',
            { error: 'User error (not exposed to client)' },
            undefined,
            undefined
          )
        } catch {
          // Ignore logging errors
        }
      }
    } catch (error) {
      // Log silently and continue
      try {
        const { logWarn } = await import('@/lib/security/logging')
        logWarn(
          'User check exception in /api/auth/me',
          { error: 'User exception (not exposed to client)' },
          undefined,
          undefined
        )
      } catch {
        // Ignore logging errors
      }
      
      // User check failed = not authenticated
      return createUnauthenticatedResponse()
    }

    // If no user or no email, return unauthenticated
    if (!user || !user.id || !user.email) {
      return createUnauthenticatedResponse()
    }

    // Step 4: Get user role from database - wrapped in try/catch
    try {
      const roleResult = await supabase
        .from('user_roles')
        .select('role, clinicId')
        .eq('user_id', user.id)
        .single()

      // Log role errors silently if any
      if (roleResult?.error) {
        try {
          const { logWarn } = await import('@/lib/security/logging')
          logWarn(
            'Role check failed in /api/auth/me',
            { error: 'Role error (not exposed to client)', userId: user.id },
            user.id,
            undefined
          )
        } catch {
          // Ignore logging errors
        }
        // Continue with null values (will be handled below)
      } else if (roleResult?.data) {
        // Extract role and clinicId - handle both snake_case and camelCase
        const metadata = roleResult.data as any
        role = (metadata?.role as string) || null
        clinicId = metadata?.clinicId || metadata?.clinic_id || null
      }
    } catch (error) {
      // Log silently and continue with null values
      try {
        const { logWarn } = await import('@/lib/security/logging')
        logWarn(
          'Role check exception in /api/auth/me',
          { error: 'Role exception (not exposed to client)', userId: user.id },
          user.id,
          undefined
        )
      } catch {
        // Ignore logging errors
      }
      // Continue with null values
      role = null
      clinicId = null
    }

    // Validate critical user data
    if (!user.id || !user.email || typeof user.id !== 'string' || typeof user.email !== 'string') {
      return createUnauthenticatedResponse()
    }

    // Ensure role and clinicId are strings (use defaults if null)
    const safeRole = role || 'patient'
    const safeClinicId = clinicId || 'default-clinic'

    // Step 5: Create and return authenticated response
    try {
      return createAuthenticatedResponse(
        user.id,
        user.email,
        safeRole,
        safeClinicId
      )
    } catch (error) {
      // Even response creation failed - return unauthenticated
      try {
        const { logWarn } = await import('@/lib/security/logging')
        logWarn(
          'Response creation failed in /api/auth/me',
          { error: 'Response creation error (not exposed to client)' },
          undefined,
          undefined
        )
      } catch {
        // Ignore logging errors
      }
      return createUnauthenticatedResponse()
    }
  } catch (error) {
    // Catch-all error handler - absolutely everything is caught here
    // This should never execute, but if it does, we return safe response
    try {
      const { logWarn } = await import('@/lib/security/logging')
      logWarn(
        'Unexpected error in /api/auth/me',
        { error: 'Unexpected error (not exposed to client)' },
        undefined,
        undefined
      )
    } catch {
      // Even logging failed - continue to return safe response
    }

    // Always return safe unauthenticated response - never throw, never 401, never 500
    return createUnauthenticatedResponse()
  }
}
