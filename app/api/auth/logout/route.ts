// TODO: User logout endpoint
// TODO: Sign out from Supabase
// TODO: Clear session cookies

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { error } = await supabase.auth.signOut()

    if (error) {
      return apiError('Failed to sign out', 500)
    }

    return apiSuccess({ message: 'Signed out successfully' })
  } catch (error: any) {
    return apiError(error.message || 'Internal server error', 500)
  }
}

