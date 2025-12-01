/**
 * Server-Side Authentication Utilities - World-Class Clinic-Level Authorization
 * 
 * Features:
 * - JWT validation
 * - Session expiry checking
 * - Role validation
 * - Tenant isolation support
 * - Audit logging
 */

import { createClient } from '@/lib/supabase/server'
import type { UserRole, AuthUser } from './types'
import { logAudit, logError } from '@/lib/security/logging'
import { redirect } from 'next/navigation'

/**
 * Validate JWT and session expiry
 */
async function validateSession(supabase: any): Promise<{
  valid: boolean
  user: any | null
  session: any | null
  error?: string
}> {
  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return {
        valid: false,
        user: null,
        session: null,
        error: userError?.message || 'No user found',
      }
    }

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return {
        valid: false,
        user,
        session: null,
        error: sessionError?.message || 'No session found',
      }
    }

    // Check session expiry
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at && session.expires_at < now) {
      return {
        valid: false,
        user,
        session,
        error: 'Session expired',
      }
    }

    return { valid: true, user, session }
  } catch (error: any) {
    return {
      valid: false,
      user: null,
      session: null,
      error: error.message || 'Session validation failed',
    }
  }
}

/**
 * Get current authenticated user with session validation
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const supabase = await createClient()
  const validation = await validateSession(supabase)

  if (!validation.valid || !validation.user) {
    return null
  }

  const { user } = validation

  // Get user metadata/role from database
  const { data: userMetadata, error: roleError } = await supabase
    .from('user_roles')
    .select('role, doctor_id, patient_id, approved')
    .eq('user_id', user.id)
    .single()

  if (roleError || !userMetadata) {
    logError(
      'User role not found',
      undefined,
      { userId: user.id },
      user.id
    )
    return null
  }

  const roleData = userMetadata as {
    role: string | null
    doctor_id: string | null
    patient_id: string | null
    approved: boolean | null
  }

  const role = (roleData.role as UserRole) || 'patient'
  const doctorId = roleData.doctor_id || undefined
  const patientId = roleData.patient_id || undefined
  const approved = roleData.approved || false

  return {
    id: user.id,
    email: user.email!,
    role,
    emailVerified: user.email_confirmed_at !== null,
    metadata: {
      doctorId,
      patientId,
      approved,
    },
  }
}

/**
 * Check if user has specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === role
}

/**
 * Check if user is doctor and approved
 */
export async function isApprovedDoctor(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'doctor' && user.metadata?.approved === true
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'admin'
}

/**
 * Check if user is patient
 */
export async function isPatient(): Promise<boolean> {
  const user = await getCurrentUser()
  return user?.role === 'patient'
}

/**
 * Require authentication (throws if not authenticated)
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    logAudit(
      'AUTH_REQUIRED',
      'user',
      'unknown',
      'unknown',
      false,
      { reason: 'No authenticated user' }
    )
    const error: Error = new Error('Unauthorized')
    throw error
  }
  return user
}

/**
 * Require specific role (throws if not authorized)
 */
export async function requireRole(role: UserRole): Promise<AuthUser> {
  const user = await requireAuth()
  if (user.role !== role) {
    logAudit(
      'ACCESS_DENIED',
      'user',
      user.id,
      user.id,
      false,
      { requiredRole: role, userRole: user.role }
    )
    throw new Error('Forbidden')
  }
  return user
}

/**
 * Require approved doctor (throws if not approved)
 */
export async function requireApprovedDoctor(): Promise<AuthUser> {
  const user = await requireRole('doctor')
  if (!user.metadata?.approved) {
    logAudit(
      'ACCESS_DENIED',
      'user',
      user.id,
      user.id,
      false,
      { reason: 'Doctor not approved' }
    )
    throw new Error('Doctor account pending approval')
  }
  return user
}

/**
 * Require patient role
 */
export async function requirePatient(): Promise<AuthUser> {
  return requireRole('patient')
}

/**
 * Require admin role
 */
export async function requireAdmin(): Promise<AuthUser> {
  return requireRole('admin')
}

/**
 * Validate tenant access (for multi-tenant scenarios)
 * This is a placeholder for future multi-tenant support
 */
export async function validateTenantAccess(
  userId: string,
  tenantId: string
): Promise<boolean> {
  // In a multi-tenant system, verify user belongs to tenant
  // For now, return true (single tenant)
  // TODO: Implement tenant isolation
  return true
}

/**
 * Check if user has access to resource
 * Combines role check with resource ownership
 */
export async function hasResourceAccess(
  userId: string,
  resourceType: 'patient' | 'appointment' | 'consultation' | 'file' | 'visit-note',
  resourceId: string,
  requestId?: string
): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) {
    return false
  }

  // Import verifyResourceAccess from api-protection
  const { verifyResourceAccess } = await import('./api-protection')
  return verifyResourceAccess(userId, user.role, resourceType, resourceId, requestId || undefined)
}

/**
 * Server Admin Helper - Safe Admin Authentication for Server Components
 * 
 * Returns:
 * - { allowed: true, user: {...} } if user is authenticated and is admin
 * - { allowed: false, reason: "unauthenticated" | "not_admin" } if not allowed
 * 
 * Features:
 * - Never throws on null sessions
 * - Uses Supabase SSR client safely
 * - Graceful error handling
 * - Type-safe return values
 */
export interface ServerAdminResult {
  allowed: boolean
  user?: AuthUser
  reason?: 'unauthenticated' | 'not_admin'
}

export async function getServerAdmin(): Promise<ServerAdminResult> {
  let supabase: any
  
  // Rule 3: Never throw on null sessions - use safe Supabase client creation
  try {
    supabase = await createClient()
    
    if (!supabase || typeof supabase.auth?.getUser !== 'function') {
      // Invalid Supabase client
      return {
        allowed: false,
        reason: 'unauthenticated',
      }
    }
  } catch (error: any) {
    // Supabase client creation failed - treat as unauthenticated
    logError('Supabase client creation failed', error, {}, 'system')
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Validate session - never throw
  let sessionValidation: { valid: boolean; user: any | null; session: any | null; error?: string }
  try {
    sessionValidation = await validateSession(supabase)
  } catch (error: any) {
    // Rule 3: Never throw - treat as unauthenticated
    logError('Session validation error', error, {}, 'system')
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Check if user is authenticated
  if (!sessionValidation.valid || !sessionValidation.user) {
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  const { user } = sessionValidation

  // Null-safe user validation
  if (!user || !user.id || typeof user.id !== 'string' || !user.email) {
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Get user role from database - never throw
  let roleData: {
    role: string | null
    clinicId: string | null
    approved: boolean
    doctor_id?: string
    patient_id?: string
  }
  
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, clinicId, clinic_id, approved, doctor_id, patient_id')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      // User role not found - treat as unauthenticated
      return {
        allowed: false,
        reason: 'unauthenticated',
      }
    }

    roleData = {
      role: data.role || null,
      clinicId: (data.clinicId || data.clinic_id) || null,
      approved: Boolean(data.approved),
      doctor_id: data.doctor_id || undefined,
      patient_id: data.patient_id || undefined,
    }
  } catch (error: any) {
    // Database query failed - treat as unauthenticated
    logError('Failed to get user role', error, { userId: user.id }, user.id)
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Check if user has admin role
  if (!roleData.role || roleData.role !== 'admin') {
    return {
      allowed: false,
      reason: 'not_admin',
    }
  }

  // User is authenticated and is admin - return user data
  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    role: 'admin' as UserRole,
    clinicId: roleData.clinicId || 'default-clinic',
    emailVerified: user.email_confirmed_at !== null,
    metadata: {
      doctorId: roleData.doctor_id,
      patientId: roleData.patient_id,
      approved: true, // Admins are always approved
    },
  }

  return {
    allowed: true,
    user: authUser,
  }
}

/**
 * Server Admin Helper with Automatic Redirect
 * 
 * If user is not authenticated or not admin, automatically redirects to /login
 * Returns user only if allowed (admin)
 * 
 * Usage in Server Components:
 * ```tsx
 * import { requireServerAdmin } from '@/lib/auth/utils'
 * 
 * export default async function AdminPage() {
 *   const user = await requireServerAdmin()
 *   // user is guaranteed to be admin at this point
 *   return <div>Welcome, {user.email}</div>
 * }
 * ```
 */
export async function requireServerAdmin(): Promise<AuthUser> {
  const result = await getServerAdmin()
  
  if (!result.allowed) {
    // Rule 2: If not allowed → redirect('/login')
    redirect('/login')
  }
  
  // TypeScript knows user exists here because allowed is true
  return result.user!
}
