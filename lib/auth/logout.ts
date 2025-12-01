/**
 * Hardened Logout Utility
 * 
 * Comprehensive logout flow that handles all edge cases:
 * - Expired sessions
 * - Corrupted cookies
 * - Partial session objects
 * - Network failures
 * - Missing user objects
 * 
 * Requirements:
 * 1. supabase.auth.signOut()
 * 2. Clear react auth state (client-side only)
 * 3. Redirect to /login
 * 4. Do not assume user exists
 * 5. Handle all edge cases gracefully
 */

import { createClient } from '@/lib/supabase/client'

export interface LogoutResult {
  success: boolean
  error?: string
  cleared: boolean
}

/**
 * Client-side hardened logout
 * Clears Supabase session, handles all edge cases
 */
export async function performLogout(): Promise<LogoutResult> {
  try {
    // Requirement 4: Do not assume user exists
    let hadSession = false

    // Step 1: Attempt to get current session (don't assume it exists)
    try {
      const supabase = createClient()
      
      // Check if session exists (handle partial/corrupted sessions)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      
      if (!sessionError && sessionData?.session) {
        hadSession = true
        
        // Validate session structure (handle partial session objects)
        const session = sessionData.session
        
        // Edge case: Partial session object (missing required fields)
        if (!session || typeof session !== 'object') {
          // Corrupted session - continue with logout anyway
          hadSession = false
        }
        
        // Edge case: Expired session
        if (session?.expires_at) {
          const now = Math.floor(Date.now() / 1000)
          if (session.expires_at < now) {
            // Session expired - clear anyway
            hadSession = false
          }
        }
      }
    } catch (checkError) {
      // Edge case: Error checking session (corrupted cookies, network error)
      // Continue with logout anyway
      hadSession = false
    }

    // Step 2: Attempt Supabase sign out
    // Requirement 1: supabase.auth.signOut()
    let signOutError: any = null
    
    try {
      const supabase = createClient()
      
      // Requirement 5: Handle edge cases - signOut will handle:
      // - Expired sessions (clears anyway)
      // - Corrupted cookies (handles gracefully)
      // - Partial session objects (validates internally)
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        signOutError = error
        // Continue - we'll clear cookies manually
      }
    } catch (signOutException: any) {
      // Edge case: Sign out threw exception
      // Could be: network error, corrupted state, etc.
      signOutError = signOutException
      // Continue - we'll clear cookies manually
    }

    // Step 3: Clear cookies manually (in case Supabase didn't)
    // Handle edge case: Corrupted cookies that Supabase couldn't clear
    try {
      // Clear all known Supabase cookie names
      const cookieNames = [
        'sb-access-token',
        'sb-refresh-token',
        `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1]?.split('.')[0]}-auth-token`,
      ]
      
      cookieNames.forEach(name => {
        try {
          // Clear cookie with all possible paths and domains
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname};`
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${window.location.hostname};`
        } catch (cookieError) {
          // Ignore individual cookie clear errors
        }
      })
    } catch (cookieClearError) {
      // Ignore cookie clear errors - Supabase may have already cleared them
    }

    // Step 4: Call logout API to ensure server-side cleanup
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch(() => {
        // Ignore API errors - client-side cleanup is done
      })
    } catch (apiError) {
      // Ignore API errors - client-side cleanup is done
    }

    // Return success even if signOut had errors
    // State clearing and redirect will be handled by caller
    return {
      success: true,
      error: signOutError?.message,
      cleared: true,
    }
  } catch (error: any) {
    // Catch-all - return error but still indicate we attempted cleanup
    return {
      success: false,
      error: error?.message || 'Logout failed',
      cleared: false,
    }
  }
}

/**
 * Check if session is valid (non-null, non-expired)
 * Handles edge cases: null, partial, expired sessions
 */
export function isValidSession(session: any): boolean {
  if (!session || typeof session !== 'object') {
    return false
  }

  // Check expiration (handle missing expires_at)
  if (session.expires_at) {
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at < now) {
      return false // Expired
    }
  }

  // Check required fields (handle partial session objects)
  if (!session.access_token && !session.refresh_token) {
    return false // Partial session
  }

  return true
}

