/**
 * Hardened Logout Route
 * 
 * Handles all edge cases:
 * - Expired sessions
 * - Corrupted cookies
 * - Partial session objects
 * - Missing user
 * 
 * Always returns success - clears cookies regardless of session state
 */

import { NextRequest, NextResponse } from 'next/server'
import { signOut } from '@/lib/auth/supabase'
import { addSecurityHeaders } from '@/lib/security/headers'

export async function POST(request: NextRequest) {
  // Always return success - clear cookies regardless of errors
  let cookiesCleared = false

  try {
    // Step 1: Attempt Supabase sign out
    // Requirement 1: supabase.auth.signOut()
    // This handles: expired sessions, corrupted cookies, partial session objects
    const { error, response } = await signOut(request)

    // Step 2: Clear cookies even if signOut had errors
    // Handle edge case: corrupted cookies that Supabase couldn't clear
    const clearedCookiesResponse = NextResponse.json(
      { message: 'Signed out successfully', cleared: true },
      { status: 200 }
    )

    // Clear all known Supabase cookie patterns
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      // Pattern: sb-{project-ref}-auth-token
      ...Array.from(request.cookies.getAll().map(c => c.name).filter(name => 
        name.startsWith('sb-') && name.includes('-auth-token')
      )),
    ]

    cookieNames.forEach(name => {
      try {
        clearedCookiesResponse.cookies.set(name, '', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 0, // Clear cookie
        })
      } catch {
        // Ignore individual cookie clear errors
      }
    })

    // Also clear cookies from signOut response if available
    if (response) {
      response.cookies.getAll().forEach(cookie => {
        try {
          clearedCookiesResponse.cookies.set(cookie.name, '', {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
          })
          cookiesCleared = true
        } catch {
          // Ignore individual cookie clear errors
        }
      })
    }

    cookiesCleared = true
    return addSecurityHeaders(clearedCookiesResponse)

  } catch (error: any) {
    // Edge case: Exception during logout
    // Still clear cookies and return success
    const errorResponse = NextResponse.json(
      { 
        message: 'Logout completed (some cleanup may have failed)', 
        cleared: cookiesCleared,
        error: error?.message || 'Unknown error'
      },
      { status: 200 } // Always return 200, never 500
    )

    // Attempt to clear cookies even on error
    const cookieNames = [
      'sb-access-token',
      'sb-refresh-token',
      ...Array.from(request.cookies.getAll().map(c => c.name).filter(name => 
        name.startsWith('sb-') && name.includes('-auth-token')
      )),
    ]

    cookieNames.forEach(name => {
      try {
        errorResponse.cookies.set(name, '', {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 0,
        })
      } catch {
        // Ignore
      }
    })

    return addSecurityHeaders(errorResponse)
  }
}

