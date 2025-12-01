/**
 * World-Class Access Control Guards
 * 
 * Comprehensive RBAC system for HIPAA-compliant telehealth platform.
 * 
 * Features:
 * - Session validation with JWT expiry checking
 * - Role-based access control (RBAC)
 * - Clinic-level tenant isolation
 * - Doctor-to-patient relationship validation
 * - Patient self-access verification
 * - Resource ownership checks
 * - Comprehensive audit logging
 * - PHI access tracking
 * 
 * All PHI access must include:
 * - Audit log entry
 * - ClinicId check
 * - Role check
 * - Patient assignment check (for doctors)
 */

import { NextRequest } from 'next/server'
import { Request } from 'express'
import { createClient } from '@/lib/supabase/server'
import type { UserRole, AuthUser } from './types'
import { logAudit, logError } from '@/lib/security/logging'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/db/prisma'

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
  clinicId: string // Tenant isolation - clinic identifier
  metadata: {
    doctorId?: string
    patientId?: string
    approved: boolean
  }
}

/**
 * Request context for logging and audit trails
 */
export interface GuardContext {
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
 * Get guard context from request
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
 * 1. REQUIRE SESSION
 * 
 * Require valid session - returns full user session or throws 401
 * Works with both Next.js API routes and Cloud Functions
 * 
 * Replaces all direct Supabase session access
 */
export async function requireSession(
  request?: NextRequest | Request
): Promise<UserSession> {
  const supabase = await createClient()
  const context = request
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

  // Get user role and clinicId from database
  const { data: userMetadata, error: roleError } = await supabase
    .from('user_roles')
    .select('role, doctor_id, patient_id, approved, clinicId')
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
    clinicId: string | null
  }

  // Validate clinicId exists
  if (!roleData.clinicId) {
    logError(
      'User clinicId not found',
      undefined,
      { userId: user.id, pathname: context.pathname },
      user.id,
      context.requestId
    )

    const error: Error & { statusCode?: number } = new Error('User clinic not assigned')
    error.statusCode = 500
    throw error
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
      clinicId: roleData.clinicId,
      ip: context.ip,
      userAgent: context.userAgent,
    }
  )

  return {
    id: user.id,
    email: user.email!,
    role: (roleData.role as UserRole) || 'patient',
    emailVerified: user.email_confirmed_at !== null,
    clinicId: roleData.clinicId,
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
 * 2. REQUIRE ROLE
 * 
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
        clinicId: user.clinicId,
      }
    )

    const error: Error & { statusCode?: number } = new Error('Forbidden: Insufficient role permissions')
    error.statusCode = 403
    throw error
  }
}

/**
 * 3. REQUIRE CLINIC ACCESS
 * 
 * Verify that a resource belongs to the user's clinic (tenant isolation)
 * Throws 403 if clinic mismatch
 */
export async function requireClinicAccess(
  user: AuthUser | UserSession,
  resourceClinicId: string | null | undefined,
  resourceType: string,
  resourceId: string,
  context?: GuardContext
): Promise<void> {
  if (!resourceClinicId) {
    logAudit(
      'CLINIC_ACCESS_DENIED',
      resourceType,
      resourceId,
      user.id,
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        reason: 'Resource has no clinicId assigned',
        userClinicId: user.clinicId,
      }
    )
    const error: Error & { statusCode?: number } = new Error('Resource clinic not found')
    error.statusCode = 404
    throw error
  }

  if (resourceClinicId !== user.clinicId) {
    logAudit(
      'CLINIC_ACCESS_DENIED',
      resourceType,
      resourceId,
      user.id,
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        reason: 'Clinic mismatch',
        userClinicId: user.clinicId,
        resourceClinicId,
      }
    )
    const error: Error & { statusCode?: number } = new Error('Forbidden: Access denied to this clinic\'s data')
    error.statusCode = 403
    throw error
  }
}

/**
 * Check if a doctor has a relationship with a patient through:
 * - Appointments
 * - Consultations
 * - Lab orders
 * - Visit notes
 * - Message threads
 */
async function hasDoctorPatientRelationship(
  doctorId: string,
  patientId: string
): Promise<boolean> {
  // Check for appointments (most common relationship)
  const hasAppointment = await prisma.appointment.findFirst({
    where: { doctorId, patientId },
    select: { id: true },
  })
  if (hasAppointment) return true

  // Check for consultations
  const hasConsultation = await prisma.consultation.findFirst({
    where: { doctorId, patientId },
    select: { id: true },
  })
  if (hasConsultation) return true

  // Check for lab orders
  const hasLabOrder = await prisma.labOrder.findFirst({
    where: { doctorId, patientId },
    select: { id: true },
  })
  if (hasLabOrder) return true

  // Check for visit notes
  const hasVisitNote = await prisma.visitNote.findFirst({
    where: { doctorId, patientId },
    select: { id: true },
  })
  if (hasVisitNote) return true

  // Check for message threads
  const hasMessageThread = await prisma.messageThread.findFirst({
    where: { doctorId, patientId },
    select: { id: true },
  })
  if (hasMessageThread) return true

  return false
}

/**
 * 4. REQUIRE DOCTOR ACCESS TO PATIENT
 * 
 * Comprehensive doctor-to-patient access check
 * 
 * Validates:
 * 1. User role is "doctor"
 * 2. Doctor's clinicId matches patient's clinicId
 * 3. Doctor has a relationship with patient via appointments, consultations, etc.
 * 
 * Includes full audit logging for PHI access
 */
export async function requireDoctorAccessToPatient(
  user: AuthUser | UserSession,
  patientId: string,
  context?: GuardContext
): Promise<void> {
  try {
    // 1. Verify user role is "doctor"
    if (user.role !== 'doctor') {
      logAudit(
        'DOCTOR_ROLE_REQUIRED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userRole: user.role,
          patientId,
          clinicId: user.clinicId,
          reason: 'User role is not doctor',
        }
      )
      const error: Error & { statusCode?: number } = new Error('Forbidden: Doctor role required')
      error.statusCode = 403
      throw error
    }

    // 2. Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: { id: true, clinicId: true },
    })

    if (!doctor) {
      logAudit(
        'DOCTOR_NOT_FOUND',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          patientId,
          clinicId: user.clinicId,
          reason: 'Doctor profile not found',
        }
      )
      const error: Error & { statusCode?: number } = new Error('Doctor profile not found')
      error.statusCode = 404
      throw error
    }

    // 3. Verify clinic ID matches (tenant isolation)
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, clinicId: true },
    })

    if (!patient) {
      logAudit(
        'PATIENT_NOT_FOUND',
        'patient',
        patientId,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          clinicId: user.clinicId,
        }
      )
      const error: Error & { statusCode?: number } = new Error('Patient not found')
      error.statusCode = 404
      throw error
    }

    if (patient.clinicId !== doctor.clinicId) {
      logAudit(
        'CLINIC_MISMATCH',
        'patient',
        patientId,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          patientClinicId: patient.clinicId,
          requestedClinicId: doctor.clinicId,
          clinicId: user.clinicId,
          reason: 'Patient belongs to different clinic',
        }
      )
      const error: Error & { statusCode?: number } = new Error('Forbidden: Patient does not belong to your clinic')
      error.statusCode = 403
      throw error
    }

    // 4. Verify doctor has a relationship with patient (patient assignment check)
    const hasRelationship = await hasDoctorPatientRelationship(doctor.id, patientId)

    if (!hasRelationship) {
      logAudit(
        'DOCTOR_PATIENT_RELATIONSHIP_NOT_FOUND',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          doctorId: doctor.id,
          patientId,
          clinicId: doctor.clinicId,
          reason: 'Doctor has no relationship with patient (no appointments, consultations, lab orders, visit notes, or messages)',
        }
      )
      const error: Error & { statusCode?: number } = new Error(
        'Forbidden: You do not have an established clinical relationship with this patient. ' +
        'Access requires an appointment, consultation, lab order, visit note, or message thread.'
      )
      error.statusCode = 403
      throw error
    }

    // Success - log PHI access grant
    logAudit(
      'PHI_ACCESS_GRANTED',
      'patient',
      patientId,
      user.id,
      true,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        accessType: 'doctor_to_patient',
        doctorId: doctor.id,
        patientId,
        clinicId: doctor.clinicId,
      }
    )
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    logError(
      'Failed to verify doctor-to-patient access',
      error as Error,
      { userId: user.id, patientId, userRole: user.role, clinicId: user.clinicId },
      user.id,
      context?.requestId
    )

    const newError: Error & { statusCode?: number } = new Error('Failed to verify doctor-to-patient access')
    newError.statusCode = 500
    throw newError
  }
}

/**
 * 5. REQUIRE PATIENT SELF ACCESS
 * 
 * Verify that a patient is accessing their own data
 * Throws 403 if patient tries to access another patient's data
 */
export async function requirePatientSelfAccess(
  user: AuthUser | UserSession,
  patientId: string,
  context?: GuardContext
): Promise<void> {
  try {
    // Verify user is a patient
    if (user.role !== 'patient') {
      logAudit(
        'PATIENT_ROLE_REQUIRED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userRole: user.role,
          patientId,
          clinicId: user.clinicId,
        }
      )
      const error: Error & { statusCode?: number } = new Error('Forbidden: Patient role required')
      error.statusCode = 403
      throw error
    }

    // Get patient record
    const patient = await prisma.patient.findUnique({
      where: { userId: user.id },
      select: { id: true, clinicId: true },
    })

    if (!patient) {
      logAudit(
        'PATIENT_NOT_FOUND',
        'patient',
        'self',
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          clinicId: user.clinicId,
          reason: 'Patient profile not found',
        }
      )
      const error: Error & { statusCode?: number } = new Error('Patient profile not found')
      error.statusCode = 404
      throw error
    }

    // Verify clinic match
    if (patient.clinicId !== user.clinicId) {
      logAudit(
        'CLINIC_MISMATCH',
        'patient',
        patient.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          patientClinicId: patient.clinicId,
          userClinicId: user.clinicId,
        }
      )
      const error: Error & { statusCode?: number } = new Error('Forbidden: Clinic mismatch')
      error.statusCode = 403
      throw error
    }

    // Check ownership
    if (patient.id !== patientId) {
      logAudit(
        'OWNERSHIP_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userPatientId: patient.id,
          requestedPatientId: patientId,
          clinicId: user.clinicId,
          reason: 'Patient cannot access another patient\'s data',
        }
      )
      const error: Error & { statusCode?: number } = new Error('Forbidden: You can only access your own data')
      error.statusCode = 403
      throw error
    }

    // Success - log PHI access
    logAudit(
      'PHI_ACCESS_GRANTED',
      'patient',
      patientId,
      user.id,
      true,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        accessType: 'patient_self',
        clinicId: patient.clinicId,
      }
    )
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    logError(
      'Failed to verify patient self access',
      error as Error,
      { userId: user.id, patientId, userRole: user.role, clinicId: user.clinicId },
      user.id,
      context?.requestId
    )

    const newError: Error & { statusCode?: number } = new Error('Failed to verify patient self access')
    newError.statusCode = 500
    throw newError
  }
}

/**
 * 6. REQUIRE OWNERSHIP
 * 
 * Verify that a user owns a resource (generic ownership check)
 * Supports both patient and doctor ownership scenarios
 * 
 * @param userId - The authenticated user's ID
 * @param resourceOwnerId - The ID of the resource owner
 * @param userRole - The user's role
 * @param context - Request context for logging
 */
export async function requireOwnership(
  userId: string,
  resourceOwnerId: string,
  userRole: UserRole,
  context?: GuardContext
): Promise<void> {
  try {
    // Admin can access any resource
    if (userRole === 'admin') {
      logAudit(
        'OWNERSHIP_VERIFIED',
        'admin',
        resourceOwnerId,
        userId,
        true,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          reason: 'Admin access granted',
        }
      )
      return
    }

    // For patients, check if they own the resource
    if (userRole === 'patient') {
      const patient = await prisma.patient.findUnique({
        where: { userId },
        select: { id: true, clinicId: true },
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
            userRole,
            resourceOwnerId,
            userPatientId: patient.id,
            clinicId: patient.clinicId,
            reason: 'Patient does not own resource',
          }
        )
        const error: Error & { statusCode?: number } = new Error('Forbidden: You do not have access to this resource')
        error.statusCode = 403
        throw error
      }

      logAudit(
        'OWNERSHIP_VERIFIED',
        'user',
        resourceOwnerId,
        userId,
        true,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userRole,
          clinicId: patient.clinicId,
        }
      )
      return
    }

    // For doctors, ownership is more complex - use requireDoctorAccessToPatient instead
    if (userRole === 'doctor') {
      logAudit(
        'OWNERSHIP_CHECK_NEEDS_DOCTOR_ACCESS',
        'user',
        userId,
        userId,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userRole,
          resourceOwnerId,
          reason: 'Use requireDoctorAccessToPatient for doctor access',
        }
      )
      const error: Error & { statusCode?: number } = new Error('Forbidden: Use requireDoctorAccessToPatient for doctor access')
      error.statusCode = 403
      throw error
    }
  } catch (error: any) {
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
 * Combined guard helper - ensures ownership OR doctor access
 * Useful for resources accessible by both patients (own data) and doctors (with relationship)
 */
export async function ensureOwnershipOrDoctor(
  user: AuthUser | UserSession,
  patientId: string,
  context?: GuardContext
): Promise<void> {
  if (user.role === 'patient') {
    await requirePatientSelfAccess(user, patientId, context)
  } else if (user.role === 'doctor') {
    await requireDoctorAccessToPatient(user, patientId, context)
  } else if (user.role === 'admin') {
    logAudit(
      'ADMIN_ACCESS_GRANTED',
      'user',
      user.id,
      user.id,
      true,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        patientId,
        clinicId: user.clinicId,
      }
    )
    return
  } else {
    logAudit(
      'ACCESS_DENIED_NO_OWNERSHIP_OR_DOCTOR',
      'user',
      user.id,
      user.id,
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        userRole: user.role,
        patientId,
        clinicId: user.clinicId,
        reason: 'User is neither the patient owner nor a doctor with access',
      }
    )
    const error: Error & { statusCode?: number } = new Error('Forbidden: Access denied')
    error.statusCode = 403
    throw error
  }
}

/**
 * Admin API Route Guard - Safe Admin Authentication
 * 
 * Returns controlled 200 response instead of throwing errors.
 * Never returns 401 or 500 - always returns 200 with allowed flag.
 * 
 * Requirements:
 * 1. Read session from cookies or Supabase server client
 * 2. Return controlled 200 with { allowed: false, reason: "unauthenticated" } (Never 401 or 500)
 * 3. Only allow role="admin"
 * 4. Never assume user or role exists
 * 5. Add audit logging only if session exists
 */
export interface AdminGuardResult {
  allowed: boolean
  user?: AuthUser
  reason?: 'unauthenticated' | 'not_admin'
}

export async function requireAdmin(request?: NextRequest): Promise<AdminGuardResult> {
  let supabase: any
  let context: GuardContext

  // Get request context safely
  try {
    context = request ? getGuardContext(request) : { requestId: uuidv4() }
  } catch (error: any) {
    // Context creation failed - return unauthenticated
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Requirement 1: Read session from cookies or Supabase server client
  try {
    supabase = await createClient()
    
    if (!supabase || typeof supabase.auth?.getUser !== 'function') {
      // Invalid Supabase client - return unauthenticated
      return {
        allowed: false,
        reason: 'unauthenticated',
      }
    }
  } catch (error: any) {
    // Supabase client creation failed - return unauthenticated
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Validate session - never throw
  let sessionValidation: { valid: boolean; user: any | null; session: any | null; error?: string }
  try {
    sessionValidation = await validateFullSession(supabase)
  } catch (error: any) {
    // Session validation threw error - return unauthenticated
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Requirement 4: Never assume user or role exists
  if (!sessionValidation.valid || !sessionValidation.user || !sessionValidation.session) {
    // Requirement 2: Return controlled 200 with { allowed: false, reason: "unauthenticated" }
    // Note: Audit logging only if session exists - no session here, so no audit log
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  const { user, session } = sessionValidation

  // Requirement 4: Validate user object structure
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
  } | null = null

  try {
    const { data, error: roleError } = await supabase
      .from('user_roles')
      .select('role, clinicId, clinic_id, approved, doctor_id, patient_id')
      .eq('user_id', user.id)
      .single()

    if (roleError || !data) {
      // Role not found - return unauthenticated
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
    // Database query failed - return unauthenticated
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Requirement 4: Never assume role exists
  if (!roleData || !roleData.role || typeof roleData.role !== 'string') {
    return {
      allowed: false,
      reason: 'unauthenticated',
    }
  }

  // Requirement 3: Only allow role="admin"
  if (roleData.role !== 'admin') {
    // Requirement 5: Add audit logging only if session exists
    // Session exists here, so we log the access attempt
    try {
      logAudit(
        'ADMIN_ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context.requestId,
          pathname: context.pathname,
          userRole: roleData.role,
          reason: 'Non-admin access attempt',
          ip: context.ip,
          userAgent: context.userAgent,
        }
      )
    } catch (auditError) {
      // Audit logging failed - continue anyway
    }

    return {
      allowed: false,
      reason: 'not_admin',
    }
  }

  // User is authenticated and is admin
  // Requirement 5: Add audit logging only if session exists
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

  // Log successful admin access (session exists)
  try {
    logAudit(
      'ADMIN_ACCESS_GRANTED',
      'user',
      user.id,
      user.id,
      true,
      {
        requestId: context.requestId,
        pathname: context.pathname,
        role: 'admin',
        clinicId: roleData.clinicId,
        ip: context.ip,
        userAgent: context.userAgent,
      }
    )
  } catch (auditError) {
    // Audit logging failed - continue anyway
  }

  return {
    allowed: true,
    user: authUser,
  }
}
