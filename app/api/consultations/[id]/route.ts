/**
 * Consultation API Route - World-Class Access Control Example
 * 
 * Demonstrates comprehensive RBAC with:
 * - Session validation
 * - Role checks
 * - Clinic access validation
 * - Doctor-to-patient relationship checks
 * - Patient self-access checks
 * - PHI access audit logging
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import {
  requireSession,
  requireRole,
  requireDoctorAccessToPatient,
  requirePatientSelfAccess,
  getGuardContext,
} from '@/lib/auth/guards'
import { enforceTenant } from '@/lib/auth/tenant'
import { validate } from '@/lib/validation'
import { consultationUpdateSchema } from '@/lib/validation/schemas'
import { logConsultationAccess } from '@/lib/logging/audit'
import { prisma } from '@/db/prisma'
import { consultationSelectWithSoap } from '@/lib/db/selects'

/**
 * GET - Get consultation details
 * 
 * Access rules:
 * - Doctors: Can access if they have relationship with patient
 * - Patients: Can access their own consultations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session (replaces direct Supabase access)
    const user = await requireSession(request)

    // 2. Require role check
    requireRole(user, ['doctor', 'patient'], context)

    // OPTIMIZED: Fetch consultation with minimal SELECT and clinicId validation
    const consultation = await prisma.consultation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clinicId: true, // Include clinicId directly for faster tenant check
        patientId: true,
        doctorId: true,
        ...consultationSelectWithSoap,
        patient: {
          select: {
            id: true,
            clinicId: true,
          },
        },
      },
    })

    if (!consultation) {
      return apiError('Consultation not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation using clinicId from consultation directly
    if (consultation.clinicId !== user.clinicId) {
      return apiError('Forbidden: Consultation belongs to different clinic', 403, context.requestId)
    }

    // 5. Patient assignment check based on role
    if (user.role === 'doctor') {
      // Doctor must have relationship with patient
      await requireDoctorAccessToPatient(user, consultation.patient.id, context)
    } else if (user.role === 'patient') {
      // Patient must own the consultation
      await requirePatientSelfAccess(user, consultation.patient.id, context)
    }

    // 6. Audit log: Consultation access (PHI-safe - only logs metadata)
    logConsultationAccess(
      user.id,
      user.clinicId,
      params.id,
      context.ip,
      request,
      context.requestId
    ).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

    return apiSuccess(consultation, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

/**
 * PUT - Update consultation
 * 
 * Access rules:
 * - Doctors: Can update consultations for their patients
 * - Patients: Can update their own consultations (limited fields)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session
    const user = await requireSession(request)

    // 2. Require role check
    requireRole(user, ['doctor', 'patient'], context)

    const body = await request.json()
    const validatedData = validate(consultationUpdateSchema, body, context.requestId)
    
    // Convert datetime strings to Date objects if needed
    const updateData: any = { ...validatedData }
    if (validatedData.startedAt) {
      updateData.startedAt = typeof validatedData.startedAt === 'string' 
        ? new Date(validatedData.startedAt)
        : validatedData.startedAt
    }
    if (validatedData.endedAt) {
      updateData.endedAt = typeof validatedData.endedAt === 'string'
        ? new Date(validatedData.endedAt)
        : validatedData.endedAt
    }

    // OPTIMIZED: Fetch consultation with minimal SELECT and clinicId validation
    const consultation = await prisma.consultation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clinicId: true, // Include clinicId directly for faster tenant check
        patientId: true,
        doctorId: true,
        patient: {
          select: {
            id: true,
            clinicId: true,
          },
        },
      },
    })

    if (!consultation) {
      return apiError('Consultation not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation using clinicId from consultation directly
    if (consultation.clinicId !== user.clinicId) {
      return apiError('Forbidden: Consultation belongs to different clinic', 403, context.requestId)
    }

    // 5. Patient assignment check
    if (user.role === 'doctor') {
      await requireDoctorAccessToPatient(user, consultation.patient.id, context)
    } else if (user.role === 'patient') {
      await requirePatientSelfAccess(user, consultation.patient.id, context)
    }

    // 6. Update consultation
    const updated = await prisma.consultation.update({
      where: { id: params.id },
      data: updateData,
      select: consultationSelectWithSoap,
    })

    return apiSuccess(updated, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

