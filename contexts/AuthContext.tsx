'use client'

// TODO: Session-based context provider for Next.js
// TODO: Provide authentication state to all components
// TODO: Handle session refresh
// TODO: Provide user role and approval status

import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AuthUser } from '@/lib/auth/types'

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  // TODO: Fetch current user session
  const fetchUser = async () => {
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser) {
        setUser(null)
        setLoading(false)
        return
      }

      // Get user role from database
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('role, doctor_id, patient_id, approved')
        .eq('user_id', authUser.id)
        .single()

      if (userRole) {
        setUser({
          id: authUser.id,
          email: authUser.email!,
          role: userRole.role as 'doctor' | 'patient' | 'admin',
          emailVerified: authUser.email_confirmed_at !== null,
          metadata: {
            doctorId: userRole.doctor_id,
            patientId: userRole.patient_id,
            approved: userRole.approved,
          },
        })
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  // TODO: Sign out user
  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  // TODO: Refresh user session
  const refresh = async () => {
    setLoading(true)
    await fetchUser()
  }

  useEffect(() => {
    // Initial fetch
    fetchUser()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        fetchUser()
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

