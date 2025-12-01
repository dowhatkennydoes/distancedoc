'use client'

/**
 * Robust Authentication Context Provider
 * 
 * Key Principles:
 * - Unauthenticated users are a VALID STATE, not an error
 * - Never throws errors in the provider
 * - Never renders undefined user (always null)
 * - Graceful fallback: fetch failures → unauthenticated (stable)
 * - authReady flag for hydration safety
 * 
 * Requirements Met:
 * 1. When /api/auth/me returns authenticated=false:
 *    - user = null
 *    - authenticated = false
 *    - loading = false
 *    - authReady = true
 * 2. No errors thrown in provider (all wrapped in try/catch)
 * 3. Never breaks on undefined user (always null)
 * 4. Fetch failures treated as unauthenticated (graceful, stable)
 * 5. authReady boolean for components to wait for hydration
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { performLogout } from '@/lib/auth/logout'
import type { AuthUser, UserRole } from '@/lib/auth/types'

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

interface AuthContextType {
  user: AuthUser | null
  authenticated: boolean
  loading: boolean
  authReady: boolean // Indicates initial auth check is complete (hydration-safe)
  error: string | null
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (user: AuthUser | null) => void
  clearError: () => void
  // Helper functions
  isDoctor: () => boolean
  isPatient: () => boolean
  isAdmin: () => boolean
  getClinicId: () => string | null
  // Auto-redirect helpers
  requireAuth: (redirectTo?: string) => void
  requireRole: (role: UserRole | UserRole[], redirectTo?: string) => void
  requireApproval: (redirectTo?: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Exponential backoff delay calculator
 */
function getRetryDelay(attempt: number, baseDelay: number = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000) // Max 30 seconds
}

/**
 * Fetch auth status from /api/auth/me with retry logic
 * Always returns a valid response - treats failures as unauthenticated (valid state)
 */
async function fetchAuthStatus(
  retryAttempt: number = 0,
  maxRetries: number = 2
): Promise<AuthMeResponse> {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // /api/auth/me always returns 200, but handle edge cases
    if (!response.ok) {
      // Non-200 response - treat as unauthenticated (valid state)
      return {
        authenticated: false,
        user: null,
        role: null,
        clinicId: null,
      }
    }

    let data: AuthMeResponse
    try {
      data = await response.json()
    } catch (parseError) {
      // JSON parse failed - treat as unauthenticated (valid state)
      return {
        authenticated: false,
        user: null,
        role: null,
        clinicId: null,
      }
    }

    // Validate response structure
    if (typeof data.authenticated !== 'boolean') {
      // Invalid structure - treat as unauthenticated (valid state)
      return {
        authenticated: false,
        user: null,
        role: null,
        clinicId: null,
      }
    }

    return data
  } catch (error: any) {
    // Network error or fetch failed
    const isNetworkError =
      error instanceof TypeError ||
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.message?.includes('Failed to fetch')

    // Retry network errors with exponential backoff
    if (isNetworkError && retryAttempt < maxRetries) {
      const delay = getRetryDelay(retryAttempt)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return fetchAuthStatus(retryAttempt + 1, maxRetries)
    }

    // All retries exhausted or non-network error
    // Graceful fallback: treat as unauthenticated (valid, stable state)
    return {
      authenticated: false,
      user: null,
      role: null,
      clinicId: null,
    }
  }
}

/**
 * Set unauthenticated state - this is a VALID state, not an error
 */
function setUnauthenticatedState(
  setUser: (user: AuthUser | null) => void,
  setAuthenticated: (auth: boolean) => void,
  setLoading: (loading: boolean) => void,
  setAuthReady: (ready: boolean) => void,
  setError: (error: string | null) => void
) {
  setUser(null)
  setAuthenticated(false)
  setLoading(false)
  setAuthReady(true) // Mark as ready - we know the auth state
  setError(null) // No error - unauthenticated is valid
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authenticated, setAuthenticated] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [authReady, setAuthReady] = useState<boolean>(false) // Tracks if initial auth check is complete
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState<boolean>(false)

  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const isFetchingRef = useRef<boolean>(false)

  // Hydration-safe: Only set mounted after client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  /**
   * Fetch user auth status safely
   * Treats unauthenticated as a VALID state, not an error
   */
  const fetchUser = useCallback(
    async (silent: boolean = false): Promise<void> => {
      // Prevent concurrent fetches
      if (isFetchingRef.current || !mounted) {
        return
      }

      try {
        isFetchingRef.current = true
        if (!silent) {
          setLoading(true)
        }
        setError(null)

        const authData = await fetchAuthStatus()

        // REQUIREMENT 1: When /api/auth/me returns authenticated=false
        if (!authData.authenticated || !authData.user) {
          // Set unauthenticated state - THIS IS VALID
          setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
          return
        }

        // Validate user data
        if (!authData.user?.id || !authData.user?.email) {
          // Invalid user data - treat as unauthenticated (valid state)
          setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
          return
        }

        // Convert response user to AuthUser format
        try {
          const authUser: AuthUser = {
            id: authData.user.id,
            email: authData.user.email,
            role: (authData.user.role as UserRole) || 'patient',
            clinicId: authData.user.clinicId || authData.clinicId || 'default-clinic',
            emailVerified: false,
            metadata: {
              approved: false,
            },
          }

          // Validate before setting
          if (!authUser.id || !authUser.email) {
            setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
            return
          }

          // User is authenticated and valid
          setUser(authUser)
          setAuthenticated(true)
          setLoading(false)
          setAuthReady(true)
          setError(null)
        } catch (userError) {
          // User conversion failed - treat as unauthenticated (valid state)
          setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
        }
      } catch (err: any) {
        // REQUIREMENT 4: Graceful fallback - fetch fails → unauthenticated (stable)
        // This is a valid state, not an error
        setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
      } finally {
        isFetchingRef.current = false
      }
    },
    [mounted]
  )

  // Initial fetch after hydration
  useEffect(() => {
    if (mounted) {
      fetchUser()
    }
  }, [mounted, fetchUser])

  // Listen for auth state changes (client-side only)
  useEffect(() => {
    if (!mounted) return

    try {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        try {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await fetchUser(true) // Silent refresh
          } else if (event === 'SIGNED_OUT') {
            // Signed out - valid unauthenticated state
            setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
          }
        } catch (err: any) {
          // Handle errors gracefully - treat as unauthenticated
          setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
        }
      })

      return () => {
        try {
          subscription.unsubscribe()
        } catch {
          // Ignore unsubscribe errors
        }
      }
    } catch (err: any) {
      // Subscription setup failed - continue without real-time updates
      // Don't throw - this is not critical
    }
  }, [mounted, fetchUser, supabase])

  /**
   * Hardened Sign Out Function
   * 
   * Requirements:
   * 1. supabase.auth.signOut()
   * 2. Clear react auth state
   * 3. Redirect to /login
   * 4. Do not assume user exists
   * 5. Handle edge cases:
   *    - expired session
   *    - corrupted cookies
   *    - partial session object
   */
  const signOut = useCallback(async (): Promise<void> => {
    // Requirement 4: Do not assume user exists - don't check, just clear
    try {
      // Step 1: Set loading state
      setLoading(true)
      setError(null)

      // Step 2: Perform hardened logout
      // Requirement 1: supabase.auth.signOut() (handled in performLogout)
      // Requirement 5: Handles all edge cases (expired session, corrupted cookies, partial session)
      const logoutResult = await performLogout()

      // Step 3: Clear React auth state (even if logout had errors)
      // Requirement 2: Clear react auth state
      setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)

      // Step 4: Redirect to login
      // Requirement 3: Redirect to /login
      try {
        router.push('/login')
      } catch (redirectError: any) {
        // Edge case: Router error - fallback to hard redirect
        try {
          window.location.href = '/login'
        } catch (hardRedirectError) {
          // Last resort: State is cleared, user can manually navigate
          // Log but don't throw
          console.warn('[AuthContext] Logout redirect failed, but state is cleared')
        }
      }
    } catch (err: any) {
      // Catch-all error handler - ensure state is always cleared
      // Even if everything fails, clear state and attempt redirect
      setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
      
      // Try redirect even on error
      try {
        router.push('/login')
      } catch {
        try {
          window.location.href = '/login'
        } catch {
          // State is cleared, user can manually navigate
          console.warn('[AuthContext] Logout complete, but redirect failed. State is cleared.')
        }
      }
    }
  }, [supabase, router])

  // Refresh user session
  const refresh = useCallback(async (): Promise<void> => {
    await fetchUser(false)
  }, [fetchUser])

  // Set user directly without API call
  const setUserDirect = useCallback((newUser: AuthUser | null): void => {
    try {
      setUser(newUser)
      setAuthenticated(!!newUser)
      setLoading(false)
      setAuthReady(true)
      setError(null)
    } catch {
      // On error, set to unauthenticated (valid state)
      setUnauthenticatedState(setUser, setAuthenticated, setLoading, setAuthReady, setError)
    }
  }, [])

  // Clear error state
  const clearError = useCallback((): void => {
    setError(null)
  }, [])

  // Helper functions - all safe with null checks
  const isDoctor = useCallback((): boolean => {
    try {
      return user?.role === 'doctor' || false
    } catch {
      return false
    }
  }, [user])

  const isPatient = useCallback((): boolean => {
    try {
      return user?.role === 'patient' || false
    } catch {
      return false
    }
  }, [user])

  const isAdmin = useCallback((): boolean => {
    try {
      return user?.role === 'admin' || false
    } catch {
      return false
    }
  }, [user])

  const getClinicId = useCallback((): string | null => {
    try {
      return user?.clinicId || null
    } catch {
      return null
    }
  }, [user])

  // Auto-redirect helpers - all wrapped in try/catch
  const requireAuth = useCallback(
    (redirectTo?: string): void => {
      try {
        if (!mounted || loading || !authReady) return
        if (!authenticated || !user) {
          try {
            router.push(redirectTo || '/login')
          } catch {
            // Ignore redirect errors
          }
        }
      } catch {
        // Ignore all errors
      }
    },
    [authenticated, user, loading, mounted, authReady, router]
  )

  const requireRole = useCallback(
    (role: UserRole | UserRole[], redirectTo?: string): void => {
      try {
        if (!mounted || loading || !authReady) return
        if (!authenticated || !user) {
          try {
            router.push(redirectTo || '/login')
          } catch {
            // Ignore redirect errors
          }
          return
        }

        const roles = Array.isArray(role) ? role : [role]
        const hasRole = roles.includes(user.role) || user.role === 'admin'

        if (!hasRole) {
          const defaultRedirect =
            user.role === 'doctor'
              ? '/dashboard'
              : user.role === 'patient'
              ? '/patient'
              : '/login'
          try {
            router.push(redirectTo || defaultRedirect)
          } catch {
            // Ignore redirect errors
          }
        }
      } catch {
        // Ignore all errors
      }
    },
    [authenticated, user, loading, mounted, authReady, router]
  )

  const requireApproval = useCallback(
    (redirectTo?: string): void => {
      try {
        if (!mounted || loading || !authReady) return
        if (!authenticated || !user) {
          try {
            router.push(redirectTo || '/login')
          } catch {
            // Ignore redirect errors
          }
          return
        }

        if (user.role === 'doctor' && !user.metadata?.approved) {
          try {
            router.push(redirectTo || '/doctor/pending')
          } catch {
            // Ignore redirect errors
          }
        }
      } catch {
        // Ignore all errors
      }
    },
    [authenticated, user, loading, mounted, authReady, router]
  )

  // Auto-redirect on unauthorized access
  useEffect(() => {
    try {
      if (!mounted || loading || !authReady) return

      const publicPages = ['/', '/login', '/signup', '/reset']
      const isPublicPage = publicPages.some(
        (page) => pathname === page || (page !== '/' && pathname?.startsWith(page))
      )

      if (isPublicPage) return

      if (!authenticated || !user) {
        try {
          router.push('/login')
        } catch {
          // Ignore redirect errors
        }
        return
      }

      if (pathname?.startsWith('/doctor') && user.role !== 'doctor' && user.role !== 'admin') {
        try {
          router.push('/dashboard')
        } catch {
          // Ignore redirect errors
        }
        return
      }

      if (pathname?.startsWith('/patient') && user.role !== 'patient' && user.role !== 'admin') {
        try {
          router.push('/dashboard')
        } catch {
          // Ignore redirect errors
        }
        return
      }

      if (pathname?.startsWith('/doctor') && user.role === 'doctor' && !user.metadata?.approved) {
        try {
          router.push('/doctor/pending')
        } catch {
          // Ignore redirect errors
        }
      }
    } catch {
      // Ignore all errors
    }
  }, [authenticated, user, loading, mounted, authReady, pathname, router])

  // Memoize context value
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user: user || null, // REQUIREMENT 3: Never undefined, always null
      authenticated: authenticated || false,
      loading: !mounted || loading,
      authReady: authReady && mounted, // REQUIREMENT 5: Ready only after mounted and initial check
      error: error || null,
      signOut,
      refresh,
      setUser: setUserDirect,
      clearError,
      isDoctor,
      isPatient,
      isAdmin,
      getClinicId,
      requireAuth,
      requireRole,
      requireApproval,
    }),
    [
      user,
      authenticated,
      loading,
      authReady,
      error,
      mounted,
      signOut,
      refresh,
      setUserDirect,
      clearError,
      isDoctor,
      isPatient,
      isAdmin,
      getClinicId,
      requireAuth,
      requireRole,
      requireApproval,
    ]
  )

  // REQUIREMENT 2: Provider never throws - all errors handled
  try {
    return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  } catch {
    // Last resort: return safe defaults
    const safeContextValue: AuthContextType = {
      user: null,
      authenticated: false,
      loading: false,
      authReady: true,
      error: null,
      signOut: async () => {},
      refresh: async () => {},
      setUser: () => {},
      clearError: () => {},
      isDoctor: () => false,
      isPatient: () => false,
      isAdmin: () => false,
      getClinicId: () => null,
      requireAuth: () => {},
      requireRole: () => {},
      requireApproval: () => {},
    }
    return <AuthContext.Provider value={safeContextValue}>{children}</AuthContext.Provider>
  }
}

/**
 * Hook to access authentication context
 * 
 * @example
 * ```tsx
 * const { user, authenticated, loading, authReady, error } = useAuth()
 * 
 * // Wait for auth to be ready
 * if (!authReady) return <Loading />
 * 
 * // Unauthenticated is a valid state
 * if (!authenticated) return <LoginPrompt />
 * 
 * // User is guaranteed to exist here
 * return <Dashboard user={user} />
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  
  // REQUIREMENT 3: Never throw, return safe defaults
  if (context === undefined) {
    // Return safe defaults instead of throwing
    const safeDefaults: AuthContextType = {
      user: null,
      authenticated: false,
      loading: false,
      authReady: false,
      error: null,
      signOut: async () => {},
      refresh: async () => {},
      setUser: () => {},
      clearError: () => {},
      isDoctor: () => false,
      isPatient: () => false,
      isAdmin: () => false,
      getClinicId: () => null,
      requireAuth: () => {},
      requireRole: () => {},
      requireApproval: () => {},
    }
    return safeDefaults
  }
  
  return context
}

/**
 * Hook to require authentication
 * Automatically redirects if not authenticated
 * 
 * @example
 * ```tsx
 * function ProtectedPage() {
 *   const { requireAuth, authReady } = useAuth()
 *   
 *   if (!authReady) return <Loading />
 *   requireAuth('/login')
 *   // User is guaranteed to be authenticated here
 * }
 * ```
 */
export function useRequireAuth(redirectTo?: string) {
  const { requireAuth, user, authenticated, loading, authReady } = useAuth()

  useEffect(() => {
    if (authReady && !loading) {
      requireAuth(redirectTo)
    }
  }, [authReady, loading, requireAuth, redirectTo])

  return { user, authenticated, loading, authReady }
}

/**
 * Hook to require specific role
 * Automatically redirects if user doesn't have required role
 * 
 * @example
 * ```tsx
 * function DoctorOnlyPage() {
 *   const { requireRole, authReady } = useAuth()
 *   
 *   if (!authReady) return <Loading />
 *   requireRole('doctor', '/dashboard')
 *   // User is guaranteed to be a doctor here
 * }
 * ```
 */
export function useRequireRole(role: UserRole | UserRole[], redirectTo?: string) {
  const { requireRole, user, authenticated, loading, authReady } = useAuth()

  useEffect(() => {
    if (authReady && !loading) {
      requireRole(role, redirectTo)
    }
  }, [authReady, loading, requireRole, role, redirectTo])

  return { user, authenticated, loading, authReady }
}
