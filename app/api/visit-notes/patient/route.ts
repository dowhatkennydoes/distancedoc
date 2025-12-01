// TODO: Patient visit notes API
// TODO: Get visit summaries for patient
// TODO: Include SOAP note data
// TODO: Read-only access

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { withClinicScope } from '@/lib/auth/tenant-scope'
import { logAccess } from '@/lib/logging/audit'
import { prisma } from '@/db/prisma'

// GET - Get patient visit notes
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Allow patient or doctor role
    requireRole(session, ['patient', 'doctor'], context)

    // Get patientId from query params if doctor, otherwise from session
    const patientIdParam = request.nextUrl.searchParams.get('patientId')
    let patientId: string

    if (session.role === 'doctor' && patientIdParam) {
      // Doctor accessing specific patient's visit notes
      await ensureOwnershipOrDoctor(session, patientIdParam, context)
      patientId = patientIdParam
    } else if (session.role === 'patient') {
      // Patient accessing their own visit notes
      const patient = await prisma.patient.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!patient) {
        return apiError('Patient profile not found', 404, context.requestId)
      }

      await ensureOwnershipOrDoctor(session, patient.id, context)
      patientId = patient.id
    } else {
      return apiError('Invalid access', 403, context.requestId)
    }

    // Get visit notes with clinic scoping using safe select
    const visitNotes = await prisma.visitNote.findMany({
      where: withClinicScope(session.clinicId, { patientId }),
      select: {
        id: true,
        appointmentId: true,
        subjective: true,
        objective: true,
        assessment: true,
        plan: true,
        chiefComplaint: true,
        diagnosis: true,
        procedures: true,
        followUpDate: true,
        signedAt: true,
        createdAt: true,
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            doctor: {
              select: {
                id: true,
                specialization: true,
                credentials: true,
              },
            },
          },
        },
        doctor: {
          select: {
            id: true,
            specialization: true,
            credentials: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Audit log: Visit notes access (PHI-safe - only logs metadata)
    logAccess({
      userId: session.id,
      clinicId: session.clinicId,
      action: 'LIST_VISIT_NOTES',
      resourceType: 'visit_note',
      resourceId: patientId,
      ip: context.ip,
      request,
      requestId: context.requestId,
      success: true,
      metadata: {
        count: visitNotes.length,
      },
    }).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

    return apiSuccess(visitNotes, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

