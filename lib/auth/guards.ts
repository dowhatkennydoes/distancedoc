/**
 * Hardened API Guard Utilities
 * 
 * Provides session validation, role checking, and ownership verification
 * for both Next.js API routes and Cloud Functions
 * 
 * Features:
 * - Full session validation with JWT expiry checking
 * - Role-based access control
 * - Resource ownership verification
 * - Comprehensive audit logging
 * - Request context tracking
 */

import { NextRequest } from 'next/server'
import { Request, Response } from 'express'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, AuthUser } from './types'
import { logAudit, logError } from '@/lib/security/logging'
import { v4 as uuidv4 } from 'uuid'

/**
 * Full user session with metadata
 */
export interface UserSession extends AuthUser {
  session: {
    access_token: string
    refresh_token: string
    expires_at: number
    expires_in: number
    token_type: string
  }
  metadata: {
    doctorId?: string
    patientId?: string
    approved: boolean
  }
}

/**
 * Request context for logging
 */
interface GuardContext {
  requestId: string
  pathname?: string
  method?: string
  ip?: string
  userAgent?: string
}

/**
 * Get request context from Next.js request
 */
function getNextRequestContext(request: NextRequest): GuardContext {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0].trim() || realIP || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const pathname = new URL(request.url).pathname
  const method = request.method
  const requestId = request.headers.get('x-request-id') || uuidv4()

  return { requestId, pathname, method, ip, userAgent }
}

/**
 * Get request context from Express request (Cloud Functions)
 */
function getExpressRequestContext(req: Request): GuardContext {
  const forwarded = req.headers['x-forwarded-for']
  const realIP = req.headers['x-real-ip']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0].trim() || 
             (typeof realIP === 'string' ? realIP : undefined) || 
             req.ip || 
             'unknown'
  const userAgent = req.headers['user-agent'] || 'unknown'
  const pathname = req.path || req.url
  const method = req.method
  const requestId = req.headers['x-request-id'] as string || uuidv4()

  return { requestId, pathname, method, ip, userAgent }
}

/**
 * Validate JWT and session, return full session
 */
async function validateFullSession(
  supabase: any,
  token?: string
): Promise<{
  valid: boolean
  user: any | null
  session: any | null
  error?: string
}> {
  try {
    let userResult

    if (token) {
      // Validate Bearer token
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      if (userError || !user) {
        return {
          valid: false,
          user: null,
          session: null,
          error: userError?.message || 'Invalid token',
        }
      }
      userResult = { user, error: null }
    } else {
      // Cookie-based auth
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return {
          valid: false,
          user: null,
          session: null,
          error: userError?.message || 'No user found',
        }
      }
      userResult = { user, error: null }
    }

    // Get full session to check expiry
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      return {
        valid: false,
        user: userResult.user,
        session: null,
        error: sessionError?.message || 'No session found',
      }
    }

    // Explicitly check session expiry
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at && session.expires_at < now) {
      return {
        valid: false,
        user: userResult.user,
        session,
        error: 'Session expired',
      }
    }

    return { valid: true, user: userResult.user, session }
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
 * Require valid session - returns full user session or throws 401
 * Works with both Next.js API routes and Cloud Functions
 */
export async function requireSession(
  request?: NextRequest | Request
): Promise<UserSession> {
  const supabase = await createClient()
  const context: GuardContext = request
    ? 'headers' in request
      ? getNextRequestContext(request as NextRequest)
      : getExpressRequestContext(request as Request)
    : { requestId: uuidv4() }

  // Get auth token from headers
  const authHeader = request?.headers
    ? 'get' in request.headers
      ? (request as NextRequest).headers.get('authorization')
      : (request as Request).headers['authorization']
    : undefined

  const token = typeof authHeader === 'string' 
    ? authHeader.replace('Bearer ', '')
    : undefined

  // Validate JWT and session
  const validation = await validateFullSession(supabase, token)

  if (!validation.valid || !validation.user || !validation.session) {
    logAudit(
      'SESSION_REQUIRED',
      'user',
      context.ip || 'unknown',
      'unknown',
      false,
      {
        requestId: context.requestId,
        pathname: context.pathname,
        userAgent: context.userAgent,
        reason: validation.error || 'Session validation failed',
      }
    )

    const error: Error & { statusCode?: number } = new Error('Unauthorized: Invalid or expired session')
    error.statusCode = 401
    throw error
  }

  const { user, session } = validation

  // Get user role from database
  const { data: userMetadata, error: roleError } = await supabase
    .from('user_roles')
    .select('role, doctor_id, patient_id, approved')
    .eq('user_id', user.id)
    .single()

  if (roleError || !userMetadata) {
    logError(
      'User role not found',
      undefined,
      { userId: user.id, pathname: context.pathname },
      user.id,
      context.requestId
    )

    const error: Error & { statusCode?: number } = new Error('User role not found')
    error.statusCode = 500
    throw error
  }

  const roleData = userMetadata as {
    role: string | null
    doctor_id: string | null
    patient_id: string | null
    approved: boolean | null
  }

  // Log successful session validation
  logAudit(
    'SESSION_VALIDATED',
    'user',
    user.id,
    user.id,
    true,
    {
      requestId: context.requestId,
      pathname: context.pathname,
      role: roleData.role,
      ip: context.ip,
      userAgent: context.userAgent,
    }
  )

  return {
    id: user.id,
    email: user.email!,
    role: (roleData.role as UserRole) || 'patient',
    emailVerified: user.email_confirmed_at !== null,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token || '',
      expires_at: session.expires_at || 0,
      expires_in: session.expires_in || 0,
      token_type: session.token_type || 'bearer',
    },
    metadata: {
      doctorId: roleData.doctor_id || undefined,
      patientId: roleData.patient_id || undefined,
      approved: roleData.approved || false,
    },
  }
}

/**
 * Require specific role(s) - ensures only allowed roles can access
 * Throws 403 if user role is not in allowedRoles
 */
export function requireRole(
  user: AuthUser | UserSession,
  allowedRoles: UserRole | UserRole[],
  context?: GuardContext
): void {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]

  if (!roles.includes(user.role)) {
    logAudit(
      'ROLE_DENIED',
      'user',
      user.id,
      user.id,
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        method: context?.method,
        userRole: user.role,
        allowedRoles: roles,
      }
    )

    const error: Error & { statusCode?: number } = new Error('Forbidden: Insufficient role permissions')
    error.statusCode = 403
    throw error
  }
}

/**
 * Require ownership - guarantees patient or doctor cannot access another user's data
 * 
 * @param userId - The authenticated user's ID
 * @param resourceOwnerId - The ID of the resource owner (patientId or doctorId)
 * @param userRole - The user's role
 * @param context - Request context for logging
 * @throws 403 if user doesn't own the resource
 */
export async function requireOwnership(
  userId: string,
  resourceOwnerId: string,
  userRole: UserRole,
  context?: GuardContext
): Promise<void> {
  const { prisma } = await import('@/db/prisma')

  try {
    // Admin can access any resource
    if (userRole === 'admin') {
      return
    }

    // For patients, check if they own the resource
    if (userRole === 'patient') {
      const patient = await prisma.patient.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (!patient) {
        const error: Error & { statusCode?: number } = new Error('Patient profile not found')
        error.statusCode = 404
        throw error
      }

      if (patient.id !== resourceOwnerId) {
        logAudit(
          'OWNERSHIP_DENIED',
          'user',
          userId,
          userId,
          false,
          {
            requestId: context?.requestId,
            pathname: context?.pathname,
            method: context?.method,
            userRole,
            resourceOwnerId,
            reason: 'Patient does not own resource',
          }
        )

        const error: Error & { statusCode?: number } = new Error('Forbidden: You do not have access to this resource')
        error.statusCode = 403
        throw error
      }

      return
    }

    // For doctors, check if they have a relationship with the patient
    if (userRole === 'doctor') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId },
        select: { id: true },
      })

      if (!doctor) {
        const error: Error & { statusCode?: number } = new Error('Doctor profile not found')
        error.statusCode = 404
        throw error
      }

      // Check if resourceOwnerId is a patient and doctor has relationship
      const patient = await prisma.patient.findUnique({
        where: { id: resourceOwnerId },
        select: { id: true },
      })

      if (!patient) {
        // If not a patient, check if it's the doctor's own resource
        if (doctor.id !== resourceOwnerId) {
          logAudit(
            'OWNERSHIP_DENIED',
            'user',
            userId,
            userId,
            false,
            {
              requestId: context?.requestId,
              pathname: context?.pathname,
              method: context?.method,
              userRole,
              resourceOwnerId,
              reason: 'Doctor does not have access to this resource',
            }
          )

          const error: Error & { statusCode?: number } = new Error('Forbidden: You do not have access to this resource')
          error.statusCode = 403
          throw error
        }
        return
      }

      // Check if doctor has appointments/consultations with this patient
      const hasRelationship = await prisma.appointment.findFirst({
        where: {
          doctorId: doctor.id,
          patientId: patient.id,
        },
        select: { id: true },
      })

      if (!hasRelationship) {
        logAudit(
          'OWNERSHIP_DENIED',
          'user',
          userId,
          userId,
          false,
          {
            requestId: context?.requestId,
            pathname: context?.pathname,
            method: context?.method,
            userRole,
            resourceOwnerId,
            reason: 'Doctor does not have relationship with patient',
          }
        )

        const error: Error & { statusCode?: number } = new Error('Forbidden: You do not have access to this patient\'s data')
        error.statusCode = 403
        throw error
      }

      return
    }

    // Support role - read-only, but still needs ownership check for sensitive data
    if (userRole === 'support') {
      // Support can view but not modify - ownership check still applies for sensitive resources
      // This can be customized based on requirements
      logAudit(
        'OWNERSHIP_DENIED',
        'user',
        userId,
        userId,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          method: context?.method,
          userRole,
          resourceOwnerId,
          reason: 'Support role requires explicit access',
        }
      )

      const error: Error & { statusCode?: number } = new Error('Forbidden: Support role requires explicit access')
      error.statusCode = 403
      throw error
    }
  } catch (error: any) {
    // Re-throw if it's already our custom error
    if (error.statusCode) {
      throw error
    }

    logError(
      'Ownership verification failed',
      error as Error,
      { userId, resourceOwnerId, userRole },
      userId,
      context?.requestId
    )

    const newError: Error & { statusCode?: number } = new Error('Failed to verify resource ownership')
    newError.statusCode = 500
    throw newError
  }
}

/**
 * Helper to get context from request
 */
export function getGuardContext(request?: NextRequest | Request): GuardContext {
  if (!request) {
    return { requestId: uuidv4() }
  }

  return 'headers' in request
    ? getNextRequestContext(request as NextRequest)
    : getExpressRequestContext(request as Request)
}

/**
 * Combined guard - session + role + ownership
 * Convenience function for common use cases
 */
export async function requireGuardedAccess(
  request: NextRequest | Request,
  options: {
    allowedRoles?: UserRole | UserRole[]
    requireOwnership?: {
      resourceOwnerId: string
    }
  }
): Promise<UserSession> {
  const context = getGuardContext(request)
  
  // Require session
  const session = await requireSession(request)

  // Require role if specified
  if (options.allowedRoles) {
    requireRole(session, options.allowedRoles, context)
  }

  // Require ownership if specified
  if (options.requireOwnership) {
    await requireOwnership(
      session.id,
      options.requireOwnership.resourceOwnerId,
      session.role,
      context
    )
  }

  return session
}

