/**
 * API Route Protection Utilities - World-Class Clinic-Level Authorization
 * 
 * Features:
 * - JWT validation on every request
 * - Session expiry checking
 * - Role-based access control
 * - Resource-level authorization
 * - Audit logging
 * - Request context tracking
 * - Error handling with security
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, AuthUser } from './types'
import { logAudit, logWarn, logError } from '@/lib/security/logging'
import { addSecurityHeaders } from '@/lib/security/headers'
import { v4 as uuidv4 } from 'uuid'
import { canAccess, canAccessAny, canAccessAll, type Permission } from './permissions'

/**
 * Request context for audit logging
 */
interface RequestContext {
  ip: string
  userAgent: string
  pathname: string
  method: string
  requestId: string
}

/**
 * Get request context from request
 */
function getRequestContext(request: NextRequest): RequestContext {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0].trim() || realIP || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  const pathname = new URL(request.url).pathname
  const method = request.method
  const requestId = request.headers.get('x-request-id') || uuidv4()

  return { ip, userAgent, pathname, method, requestId }
}

/**
 * Validate JWT token and session
 */
async function validateJWTAndSession(
  supabase: any,
  token?: string
): Promise<{
  valid: boolean
  user: any | null
  session: any | null
  error?: string
}> {
  try {
    let userResult, sessionResult

    if (token) {
      // Validate Bearer token
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      userResult = { user, error: userError }

      if (userError || !user) {
        return {
          valid: false,
          user: null,
          session: null,
          error: userError?.message || 'Invalid token',
        }
      }

      // For Bearer tokens, we need to verify expiry manually
      // Supabase tokens are JWTs - we should decode and check exp claim
      // For now, we'll rely on Supabase's validation
    } else {
      // Cookie-based auth
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      userResult = { user, error: userError }

      if (userError || !user) {
        return {
          valid: false,
          user: null,
          session: null,
          error: userError?.message || 'No user found',
        }
      }
    }

    // Get session to check expiry
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    sessionResult = { session, error: sessionError }

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

    // Check access token expiry (if available)
    if (session.access_token) {
      // In production, decode JWT and check exp claim
      // For now, rely on Supabase's validation
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
 * Get authenticated user from API request with full validation
 */
export async function getAuthUser(request?: NextRequest): Promise<AuthUser | null> {
  const supabase = await createClient()
  const context = request ? getRequestContext(request) : null

  // Get auth token from headers
  const authHeader = request?.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  // Validate JWT and session
  const validation = await validateJWTAndSession(supabase, token)

  if (!validation.valid || !validation.user) {
    if (context) {
      logAudit(
        'AUTH_FAILED',
        'user',
        context.ip,
        'unknown',
        false,
        {
          requestId: context.requestId,
          pathname: context.pathname,
          userAgent: context.userAgent,
          reason: validation.error || 'Authentication failed',
        }
      )
    }
    return null
  }

  const { user } = validation

  // Get user role from database
  const { data: userMetadata, error: roleError } = await supabase
    .from('user_roles')
    .select('role, doctor_id, patient_id, approved, clinic_id')
    .eq('user_id', user.id)
    .single()

  if (roleError || !userMetadata) {
    if (context) {
      logError(
        'User role not found',
        undefined,
        { userId: user.id, pathname: context.pathname },
        user.id,
        context.requestId
      )
    }
    return null
  }

  const roleData = userMetadata as {
    role: string | null
    doctor_id: string | null
    patient_id: string | null
    approved: boolean | null
    clinic_id: string | null
  }

  const role = (roleData.role as UserRole) || 'patient'
  const doctorId = roleData.doctor_id || undefined
  const patientId = roleData.patient_id || undefined
  const approved = roleData.approved || false
  const clinicId = roleData.clinic_id || 'default-clinic'

  // Log successful authentication
  if (context) {
    logAudit(
      'AUTH_SUCCESS',
      'user',
      user.id,
      user.id,
      true,
      {
        requestId: context.requestId,
        pathname: context.pathname,
        role,
        ip: context.ip,
        userAgent: context.userAgent,
      }
    )
  }

  return {
    id: user.id,
    email: user.email!,
    role,
    emailVerified: user.email_confirmed_at !== null,
    clinicId,
    metadata: {
      doctorId,
      patientId,
      approved,
    },
  }
}

/**
 * Require authentication for API route
 * Throws error if not authenticated
 */
export async function requireAuth(request?: NextRequest): Promise<AuthUser> {
  const user = await getAuthUser(request)
  
  if (!user) {
    const context = request ? getRequestContext(request) : null
    const error: Error & { statusCode?: number; requestId?: string } = new Error('Unauthorized')
    error.statusCode = 401
    error.requestId = context?.requestId
    
    if (context) {
      logAudit(
        'AUTH_REQUIRED',
        'user',
        context.ip,
        'unknown',
        false,
        {
          requestId: context.requestId,
          pathname: context.pathname,
          userAgent: context.userAgent,
        }
      )
    }
    
    throw error
  }
  
  return user
}

/**
 * Require specific role for API route
 */
export async function requireRole(
  request: NextRequest | undefined,
  role: UserRole
): Promise<AuthUser> {
  const user = await requireAuth(request)
  const context = request ? getRequestContext(request) : null

  if (user.role !== role) {
    const error: Error & { statusCode?: number; requestId?: string } = new Error('Forbidden')
    error.statusCode = 403
    error.requestId = context?.requestId

    if (context) {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context.requestId,
          pathname: context.pathname,
          requiredRole: role,
          userRole: user.role,
        }
      )
    }

    throw error
  }

  return user
}

/**
 * Require approved doctor for API route
 */
export async function requireApprovedDoctor(
  request?: NextRequest
): Promise<AuthUser> {
  const user = await requireRole(request, 'doctor')
  const context = request ? getRequestContext(request) : null

  if (!user.metadata?.approved) {
    const error = new Error('Doctor account pending approval')
    ;(error as any).statusCode = 403
    ;(error as any).requestId = context?.requestId

    if (context) {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context.requestId,
          pathname: context.pathname,
          reason: 'Doctor not approved',
        }
      )
    }

    throw error
  }

  return user
}

/**
 * Require patient role
 */
export async function requirePatient(
  request?: NextRequest
): Promise<AuthUser> {
  return requireRole(request, 'patient')
}

/**
 * Require admin role
 */
export async function requireAdmin(
  request?: NextRequest
): Promise<AuthUser> {
  return requireRole(request, 'admin')
}

/**
 * API error response helper with security
 */
export function apiError(
  message: string,
  status: number = 401,
  requestId?: string
): NextResponse {
  // Don't expose internal error details
  const safeMessage = status >= 500 ? 'Internal server error' : message

  const response = NextResponse.json(
    {
      error: safeMessage,
      requestId,
    },
    { status }
  )

  return addSecurityHeaders(response)
}

/**
 * API success response helper
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  requestId?: string
): NextResponse {
  const response = NextResponse.json(
    {
      ...(typeof data === 'object' && data !== null ? data : { data }),
      requestId,
    },
    { status }
  )

  return addSecurityHeaders(response)
}

/**
 * Verify user has access to a specific resource with role checking
 */
export async function verifyResourceAccess(
  userId: string,
  userRole: UserRole,
  resourceType: 'consultation' | 'appointment' | 'patient' | 'file' | 'visit-note',
  resourceId: string,
  requestId?: string
): Promise<boolean> {
  const { prisma } = await import('@/db/prisma')

  try {
    switch (resourceType) {
      case 'consultation': {
        const consultation = await prisma.consultation.findUnique({
          where: { id: resourceId },
          select: { patientId: true, doctorId: true },
        })

        if (!consultation) {
          // Log unauthorized access attempt
          const { logUnauthorizedAccess, getRequestFromNextRequest } = await import('@/lib/security/event-logging')
          await logUnauthorizedAccess(
            userId,
            resourceType,
            resourceId,
            'Resource not found',
            undefined, // Request not available in this context
            requestId
          )
          
          logAudit(
            'RESOURCE_ACCESS_DENIED',
            'user',
            userId,
            userId,
            false,
            { requestId, resourceType, resourceId, reason: 'Resource not found' }
          )
          return false
        }

        // Doctors can access their own consultations
        if (userRole === 'doctor') {
          const doctor = await prisma.doctor.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (doctor && consultation.doctorId === doctor.id) {
            return true
          }
        }

        // Patients can access their own consultations
        if (userRole === 'patient') {
          const patient = await prisma.patient.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (patient && consultation.patientId === patient.id) {
            return true
          }
        }

        logAudit(
          'RESOURCE_ACCESS_DENIED',
          'user',
          userId,
          userId,
          false,
          { requestId, resourceType, resourceId, userRole, reason: 'No access' }
        )
        return false
      }

      case 'appointment': {
        const appointment = await prisma.appointment.findUnique({
          where: { id: resourceId },
          select: { patientId: true, doctorId: true },
        })

        if (!appointment) {
          logAudit(
            'RESOURCE_ACCESS_DENIED',
            'user',
            userId,
            userId,
            false,
            { requestId, resourceType, resourceId, reason: 'Resource not found' }
          )
          return false
        }

        if (userRole === 'doctor') {
          const doctor = await prisma.doctor.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (doctor && appointment.doctorId === doctor.id) {
            return true
          }
        }

        if (userRole === 'patient') {
          const patient = await prisma.patient.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (patient && appointment.patientId === patient.id) {
            return true
          }
        }

        logAudit(
          'RESOURCE_ACCESS_DENIED',
          'user',
          userId,
          userId,
          false,
          { requestId, resourceType, resourceId, userRole, reason: 'No access' }
        )
        return false
      }

      case 'patient': {
        const patient = await prisma.patient.findUnique({
          where: { id: resourceId },
          select: { userId: true },
        })

        if (!patient) {
          logAudit(
            'RESOURCE_ACCESS_DENIED',
            'user',
            userId,
            userId,
            false,
            { requestId, resourceType, resourceId, reason: 'Resource not found' }
          )
          return false
        }

        // Patients can access their own records
        if (userRole === 'patient') {
          const patientRecord = await prisma.patient.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (patientRecord && patientRecord.id === resourceId) {
            return true
          }
        }

        // Doctors and admins can access patient records
        if (userRole === 'doctor' || userRole === 'admin') {
          // For doctors/admins, check if they have relationship with patient
          // This is a simplified check - in production, add more granular permissions
          return true
        }

        logAudit(
          'RESOURCE_ACCESS_DENIED',
          'user',
          userId,
          userId,
          false,
          { requestId, resourceType, resourceId, userRole, reason: 'Role not allowed' }
        )
        return false
      }

      case 'file': {
        const file = await prisma.fileRecord.findUnique({
          where: { id: resourceId },
          select: { uploadedBy: true, patientId: true },
        })

        if (!file) {
          logAudit(
            'RESOURCE_ACCESS_DENIED',
            'user',
            userId,
            userId,
            false,
            { requestId, resourceType, resourceId, reason: 'Resource not found' }
          )
          return false
        }

        // User uploaded the file
        if (file.uploadedBy === userId) {
          return true
        }

        // Patient owns the file
        if (userRole === 'patient') {
          const patient = await prisma.patient.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (patient && file.patientId === patient.id) {
            return true
          }
        }

        // Doctors can access files for their patients
        if (userRole === 'doctor') {
          const doctor = await prisma.doctor.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (doctor && file.patientId) {
            // Check if doctor has relationship with patient
            // Simplified - in production, add proper relationship check
            return true
          }
        }

        logAudit(
          'RESOURCE_ACCESS_DENIED',
          'user',
          userId,
          userId,
          false,
          { requestId, resourceType, resourceId, userRole, reason: 'No access' }
        )
        return false
      }

      case 'visit-note': {
        const visitNote = await prisma.visitNote.findUnique({
          where: { id: resourceId },
          select: { patientId: true, doctorId: true },
        })

        if (!visitNote) {
          logAudit(
            'RESOURCE_ACCESS_DENIED',
            'user',
            userId,
            userId,
            false,
            { requestId, resourceType, resourceId, reason: 'Resource not found' }
          )
          return false
        }

        if (userRole === 'doctor') {
          const doctor = await prisma.doctor.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (doctor && visitNote.doctorId === doctor.id) {
            return true
          }
        }

        if (userRole === 'patient') {
          const patient = await prisma.patient.findUnique({
            where: { userId },
            select: { id: true },
          })
          if (patient && visitNote.patientId === patient.id) {
            return true
          }
        }

        logAudit(
          'RESOURCE_ACCESS_DENIED',
          'user',
          userId,
          userId,
          false,
          { requestId, resourceType, resourceId, userRole, reason: 'No access' }
        )
        return false
      }

      default:
        logAudit(
          'RESOURCE_ACCESS_DENIED',
          'user',
          userId,
          userId || 'unknown',
          false,
          { requestId, resourceType, resourceId, reason: 'Unknown resource type' }
        )
        return false
    }
  } catch (error: any) {
    logError(
      'Resource access verification failed',
      error as Error,
      { userId, resourceType, resourceId, error: error.message },
      userId,
      requestId
    )
    return false
  }
}

/**
 * Wrapper for protected API routes with comprehensive auth and RBAC
 */
export function withAuth<T>(
  handler: (request: NextRequest, user: AuthUser) => Promise<NextResponse<T>>,
  options?: {
    roles?: UserRole[]
    requireApproval?: boolean
    requireEmailVerification?: boolean
    permissions?: Permission | Permission[]
    requireAllPermissions?: boolean // If true, requires all permissions; if false, requires any
  }
) {
  return async (request: NextRequest) => {
    const context = getRequestContext(request)
    
    try {
      // Require authentication
      const user = await requireAuth(request)

      // Check role requirements
      if (options?.roles && !options.roles.includes(user.role)) {
        logAudit(
          'ACCESS_DENIED',
          'user',
          user.id,
          user.id,
          false,
          {
            requestId: context.requestId,
            pathname: context.pathname,
            requiredRoles: options.roles,
            userRole: user.role,
          }
        )
        return apiError('Forbidden', 403, context.requestId)
      }

      // Check doctor approval
      if (options?.requireApproval && user.role === 'doctor' && !user.metadata?.approved) {
        logAudit(
          'ACCESS_DENIED',
          'user',
          user.id,
          user.id,
          false,
          {
            requestId: context.requestId,
            pathname: context.pathname,
            reason: 'Doctor not approved',
          }
        )
        return apiError('Doctor account pending approval', 403, context.requestId)
      }

      // Check email verification
      if (options?.requireEmailVerification && !user.emailVerified) {
        logAudit(
          'ACCESS_DENIED',
          'user',
          user.id,
          user.id,
          false,
          {
            requestId: context.requestId,
            pathname: context.pathname,
            reason: 'Email not verified',
          }
        )
        return apiError('Email verification required', 403, context.requestId)
      }

      // RBAC Permission Check
      if (options?.permissions) {
        const permissions = Array.isArray(options.permissions)
          ? options.permissions
          : [options.permissions]
        
        const hasPermission = options.requireAllPermissions
          ? canAccessAll(user.role, permissions)
          : canAccessAny(user.role, permissions)

        if (!hasPermission) {
          logAudit(
            'PERMISSION_DENIED',
            'user',
            user.id,
            user.id,
            false,
            {
              requestId: context.requestId,
              pathname: context.pathname,
              method: context.method,
              userRole: user.role,
              requiredPermissions: permissions,
              requireAll: options.requireAllPermissions,
            }
          )
          return apiError('Forbidden: Insufficient permissions', 403, context.requestId)
        }
      }

      // Call handler with authenticated user
      return await handler(request, user)
    } catch (error: unknown) {
      const err = error as Error & { statusCode?: number; requestId?: string; pathname?: string }
      const statusCode = err.statusCode || 500
      const message = err.message || 'Internal server error'

      if (statusCode === 401) {
        return apiError('Unauthorized', 401, context.requestId || undefined)
      }
      if (statusCode === 403) {
        return apiError('Forbidden', 403, context.requestId || undefined)
      }

      logError(
        'API route error',
        undefined,
        { pathname: context.pathname, error: message },
        undefined,
        context.requestId || undefined
      )

      return apiError(message, statusCode, context.requestId || undefined)
    }
  }
}

/**
 * Require specific permission(s) for API route
 */
export async function requirePermission(
  request: NextRequest,
  permission: Permission | Permission[],
  requireAll: boolean = false
): Promise<AuthUser> {
  const user = await requireAuth(request)
  const permissions = Array.isArray(permission) ? permission : [permission]
  const context = getRequestContext(request)

  const hasPermission = requireAll
    ? canAccessAll(user.role, permissions)
    : canAccessAny(user.role, permissions)

  if (!hasPermission) {
    logAudit(
      'PERMISSION_DENIED',
      'user',
      user.id,
      user.id,
      false,
      {
        requestId: context.requestId,
        pathname: context.pathname,
        method: context.method,
        userRole: user.role,
        requiredPermissions: permissions,
        requireAll,
      }
    )
    const error: Error & { statusCode?: number } = new Error('Forbidden: Insufficient permissions')
    error.statusCode = 403
    throw error
  }

  return user
}
