'use client'

/**
 * SSR-safe and hydration-safe authentication context provider
 * 
 * Features:
 * - SSR-safe session fetching via API route
 * - Hydration-safe user object (prevents hydration mismatches)
 * - Role included in session
 * - Helper functions: isDoctor, isPatient, isAdmin, getClinicId
 * - Auto-redirect on unauthorized access
 */

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser, UserRole } from '@/lib/auth/types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  setUser: (user: AuthUser | null) => void // Set user directly without API call
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

interface SessionResponse {
  user: AuthUser | null
  error?: string
}

/**
 * SSR-safe session fetcher
 * Uses API route to avoid hydration mismatches
 */
async function fetchSession(): Promise<SessionResponse> {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store', // Always fetch fresh session
    })

    if (!response.ok) {
      return { user: null }
    }

    const data = await response.json()
    return { user: data.user || null }
  } catch (error) {
    console.error('Error fetching session:', error)
    return { user: null }
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  // Hydration-safe: Only set mounted after client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // SSR-safe session fetching
  const fetchUser = useCallback(async () => {
    if (!mounted) return // Wait for hydration

    try {
      const sessionData = await fetchSession()
      setUser(sessionData.user)
    } catch (error) {
      console.error('Error fetching user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [mounted])

  // Initial fetch after hydration
  useEffect(() => {
    if (mounted) {
      fetchUser()
    }
  }, [mounted, fetchUser])

  // Listen for auth state changes (client-side only)
  useEffect(() => {
    if (!mounted) return

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Refresh session via API to get full user data
        await fetchUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [mounted, fetchUser, supabase])

  // Sign out user
  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }, [supabase, router])

  // Refresh user session
  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchUser()
  }, [fetchUser])

  // Set user directly without API call (useful after login)
  const setUserDirect = useCallback((newUser: AuthUser | null) => {
    setUser(newUser)
    setLoading(false)
  }, [])

  // Helper functions
  const isDoctor = useCallback((): boolean => {
    return user?.role === 'doctor' || false
  }, [user])

  const isPatient = useCallback((): boolean => {
    return user?.role === 'patient' || false
  }, [user])

  const isAdmin = useCallback((): boolean => {
    return user?.role === 'admin' || false
  }, [user])

  const getClinicId = useCallback((): string | null => {
    return user?.clinicId || null
  }, [user])

  // Auto-redirect helpers
  const requireAuth = useCallback(
    (redirectTo?: string) => {
      if (!mounted || loading) return
      if (!user) {
        router.push(redirectTo || '/login')
      }
    },
    [user, loading, mounted, router]
  )

  const requireRole = useCallback(
    (role: UserRole | UserRole[], redirectTo?: string) => {
      if (!mounted || loading) return
      if (!user) {
        router.push(redirectTo || '/login')
        return
      }

      const roles = Array.isArray(role) ? role : [role]
      const hasRole = roles.includes(user.role) || user.role === 'admin'

      if (!hasRole) {
        // Redirect based on user's actual role
        const defaultRedirect =
          user.role === 'doctor' ? '/dashboard' : user.role === 'patient' ? '/patient' : '/login'
        router.push(redirectTo || defaultRedirect)
      }
    },
    [user, loading, mounted, router]
  )

  const requireApproval = useCallback(
    (redirectTo?: string) => {
      if (!mounted || loading) return
      if (!user) {
        router.push(redirectTo || '/login')
        return
      }

      // Only check approval for doctors
      if (user.role === 'doctor' && !user.metadata?.approved) {
        router.push(redirectTo || '/doctor/pending')
      }
    },
    [user, loading, mounted, router]
  )

  // Auto-redirect on unauthorized access
  useEffect(() => {
    if (!mounted || loading) return

    // Skip redirect for auth pages
    const authPages = ['/login', '/signup', '/reset']
    const isAuthPage = authPages.some((page) => pathname?.startsWith(page))

    if (isAuthPage) return

    // Check if user is authenticated
    if (!user) {
      router.push('/login')
      return
    }

    // Role-based redirects
    if (pathname?.startsWith('/doctor') && user.role !== 'doctor' && user.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    if (pathname?.startsWith('/patient') && user.role !== 'patient' && user.role !== 'admin') {
      router.push('/dashboard')
      return
    }

    // Check doctor approval for doctor routes
    if (pathname?.startsWith('/doctor') && user.role === 'doctor' && !user.metadata?.approved) {
      router.push('/doctor/pending')
      return
    }
  }, [user, loading, mounted, pathname, router])

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AuthContextType>(
    () => ({
      user,
      loading: !mounted || loading, // Show loading during hydration
      signOut,
      refresh,
      setUser: setUserDirect,
      isDoctor,
      isPatient,
      isAdmin,
      getClinicId,
      requireAuth,
      requireRole,
      requireApproval,
    }),
    [user, loading, mounted, signOut, refresh, setUserDirect, isDoctor, isPatient, isAdmin, getClinicId, requireAuth, requireRole, requireApproval]
  )

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

/**
 * Hook to access authentication context
 * 
 * @example
 * ```tsx
 * const { user, isDoctor, getClinicId } = useAuth()
 * 
 * if (isDoctor()) {
 *   const clinicId = getClinicId()
 *   // Use clinicId for tenant isolation
 * }
 * ```
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
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
 *   const { requireAuth } = useAuth()
 *   requireAuth('/login')
 *   // User is guaranteed to be authenticated here
 * }
 * ```
 */
export function useRequireAuth(redirectTo?: string) {
  const { requireAuth, user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      requireAuth(redirectTo)
    }
  }, [loading, requireAuth, redirectTo])

  return { user, loading }
}

/**
 * Hook to require specific role
 * Automatically redirects if user doesn't have required role
 * 
 * @example
 * ```tsx
 * function DoctorOnlyPage() {
 *   const { requireRole } = useAuth()
 *   requireRole('doctor', '/dashboard')
 *   // User is guaranteed to be a doctor here
 * }
 * ```
 */
export function useRequireRole(role: UserRole | UserRole[], redirectTo?: string) {
  const { requireRole, user, loading } = useAuth()

  useEffect(() => {
    if (!loading) {
      requireRole(role, redirectTo)
    }
  }, [loading, requireRole, role, redirectTo])

  return { user, loading }
}
