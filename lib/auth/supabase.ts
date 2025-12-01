/**
 * Optimized Supabase Authentication Utilities
 * 
 * Provides proper Supabase clients for different contexts:
 * - createRouteHandlerClient: For API routes (Route Handlers)
 * - createServerComponentClient: For Server Components (SSR)
 * - createClient: For client-side usage
 * - getSession: Universal session getter
 */

import { createBrowserClient } from '@supabase/ssr'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/lib/supabase/database.types'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Get Supabase URL and anon key from environment
 */
function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return { url, anonKey }
}

/**
 * Create Supabase client for API routes (Route Handlers)
 * Properly handles cookies and session management
 * Uses createServerClient with proper cookie handling
 */
export function createRouteHandlerClient(
  request: NextRequest
): {
  supabase: SupabaseClient<Database>
  response: NextResponse
} {
  const { url, anonKey } = getSupabaseConfig()

  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          // Update request cookies
          request.cookies.set({
            name,
            value,
            ...options,
          })
          // Update response cookies with secure settings
          response = NextResponse.next({ request })
          response.cookies.set({
            name,
            value,
            ...options,
            httpOnly: true, // Ensure httpOnly for security
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
          })
        },
        remove(name: string, options: CookieOptions) {
          // Update request cookies
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          // Update response cookies
          response = NextResponse.next({ request })
          response.cookies.set({
            name,
            value: '',
            ...options,
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 0,
          })
        },
      },
    }
  )

  return { supabase, response }
}

/**
 * Create Supabase client for Server Components (SSR)
 * Properly handles cookies for SSR context
 */
export async function createServerComponentClient(): Promise<SupabaseClient<Database>> {
  const { url, anonKey } = getSupabaseConfig()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ 
              name, 
              value, 
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
            })
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ 
              name, 
              value: '', 
              ...options,
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              path: '/',
              maxAge: 0,
            })
          } catch (error) {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}

/**
 * Create Supabase client for client-side usage
 */
export function createClient(): SupabaseClient<Database> {
  const { url, anonKey } = getSupabaseConfig()

  return createBrowserClient<Database>(url, anonKey)
}

/**
 * Universal session getter - works in both server and client contexts
 * 
 * Server-side: Uses createServerComponentClient
 * Client-side: Uses createClient
 */
export async function getSession(context?: {
  request?: NextRequest
  type?: 'route-handler' | 'server-component' | 'client'
}): Promise<{
  session: any | null
  user: any | null
  error?: string
}> {
  try {
    if (context?.type === 'route-handler' && context.request) {
      // Route Handler context
      const { supabase } = createRouteHandlerClient(context.request)
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        return {
          session: null,
          user: null,
          error: sessionError.message,
        }
      }

      if (!session) {
        return { session: null, user: null }
      }

      // Get user to ensure session is valid
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        return {
          session: null,
          user: null,
          error: userError?.message || 'Invalid session',
        }
      }

      return { session, user }
    } else if (context?.type === 'server-component' || !context?.type) {
      // Server Component context (default for server-side)
      const supabase = await createServerComponentClient()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        return {
          session: null,
          user: null,
          error: sessionError.message,
        }
      }

      if (!session) {
        return { session: null, user: null }
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        return {
          session: null,
          user: null,
          error: userError?.message || 'Invalid session',
        }
      }

      return { session, user }
    } else {
      // Client context
      const supabase = createClient()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        return {
          session: null,
          user: null,
          error: sessionError.message,
        }
      }

      if (!session) {
        return { session: null, user: null }
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        return {
          session: null,
          user: null,
          error: userError?.message || 'Invalid session',
        }
      }

      return { session, user }
    }
  } catch (error: any) {
    return {
      session: null,
      user: null,
      error: error.message || 'Failed to get session',
    }
  }
}

/**
 * Sign in with password and properly set session cookies
 * For use in API routes
 */
export async function signInWithPassword(
  request: NextRequest,
  email: string,
  password: string
): Promise<{
  user: any | null
  session: any | null
  error: any | null
  response: NextResponse
}> {
  const { supabase, response } = createRouteHandlerClient(request)

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData.session) {
    return {
      user: null,
      session: null,
      error: authError,
      response,
    }
  }

  // Refresh session to ensure cookies are set
  await supabase.auth.getSession()

  return {
    user: authData.user,
    session: authData.session,
    error: null,
    response,
  }
}

/**
 * Sign up and properly set session cookies
 * For use in API routes
 */
export async function signUp(
  request: NextRequest,
  email: string,
  password: string,
  options?: {
    data?: Record<string, any>
    emailRedirectTo?: string
  }
): Promise<{
  user: any | null
  session: any | null
  error: any | null
  response: NextResponse
}> {
  const { supabase, response } = createRouteHandlerClient(request)

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.signUp({
    email,
    password,
    options,
  })

  if (authError || !authData.user) {
    return {
      user: null,
      session: null,
      error: authError,
      response,
    }
  }

  // If session is created, refresh to ensure cookies are set
  if (authData.session) {
    await supabase.auth.getSession()
  }

  return {
    user: authData.user,
    session: authData.session,
    error: null,
    response,
  }
}

/**
 * Sign out and clear session cookies
 * For use in API routes
 */
export async function signOut(request: NextRequest): Promise<{
  error: any | null
  response: NextResponse
}> {
  const { supabase, response } = createRouteHandlerClient(request)

  const { error } = await supabase.auth.signOut()

  return { error, response }
}

/**
 * Get current user from session
 * Works in all contexts
 */
export async function getCurrentUser(context?: {
  request?: NextRequest
  type?: 'route-handler' | 'server-component' | 'client'
}): Promise<{
  user: any | null
  error?: string
}> {
  const { user, error } = await getSession(context)

  return { user, error }
}

