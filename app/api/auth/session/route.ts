/**
 * Session Route with Proper Cookie Handling
 * 
 * Returns current user session using createRouteHandlerClient
 * Properly reads session from httpOnly cookies
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@/lib/auth/supabase'
import { getAuthUser, apiError, apiSuccess } from '@/lib/auth/api-protection'
import { addSecurityHeaders } from '@/lib/security/headers'

export async function GET(request: NextRequest) {
  try {
    // Use createRouteHandlerClient to properly read cookies
    const { supabase } = createRouteHandlerClient(request)
    
    // Verify session exists
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return addSecurityHeaders(apiError('Not authenticated', 401))
    }

    // Get authenticated user with role metadata
    const user = await getAuthUser(request)

    if (!user) {
      return addSecurityHeaders(apiError('Not authenticated', 401))
    }

    return addSecurityHeaders(apiSuccess({ user }))
  } catch (error: any) {
    return addSecurityHeaders(apiError(error.message || 'Internal server error', 500))
  }
}

