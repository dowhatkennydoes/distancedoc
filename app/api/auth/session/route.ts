// TODO: Get current user session
// TODO: Return user information and role
// TODO: Check authentication status

import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser, apiError, apiSuccess } from '@/lib/auth/api-protection'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)

    if (!user) {
      return apiError('Not authenticated', 401)
    }

    return apiSuccess({ user })
  } catch (error: any) {
    return apiError(error.message || 'Internal server error', 500)
  }
}

