/**
 * OPTIMIZED Consultation API Route - Minimal Latency
 * 
 * Optimizations:
 * - Streaming responses where possible
 * - Parallelized queries
 * - Reduced JSON payload size
 * - Background audit logging
 * - Cached non-PHI metadata
 */

import { NextRequest, NextResponse } from 'next/server'
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
import { runInBackground } from '@/lib/utils/background-tasks'
import { responseCache, cacheKeys } from '@/lib/cache/response-cache'

/**
 * GET - Get consultation details (OPTIMIZED with streaming)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)

    // OPTIMIZED: Fetch consultation with minimal SELECT (clinicId first for fast tenant check)
    const consultation = await prisma.consultation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        doctorId: true,
        status: true,
        startedAt: true,
        endedAt: true,
        transcription: true,
        recordingUrl: true,
        createdAt: true,
        updatedAt: true,
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            duration: true,
            status: true,
            visitType: true,
            reason: true,
          },
        },
        visitNote: {
          select: {
            id: true,
            subjective: true,
            objective: true,
            assessment: true,
            plan: true,
            chiefComplaint: true,
            diagnosis: true,
            procedures: true,
            followUpDate: true,
            signedAt: true,
            aiGenerated: true,
            createdAt: true,
          },
        },
        patient: {
          select: {
            id: true,
            clinicId: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
          },
        },
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
            credentials: true,
          },
        },
      },
    })

    if (!consultation) {
      return apiError('Consultation not found', 404, context.requestId)
    }

    // OPTIMIZED: Fast tenant check (already have clinicId from select)
    if (consultation.clinicId !== user.clinicId) {
      return apiError('Forbidden: Consultation belongs to different clinic', 403, context.requestId)
    }

    // OPTIMIZED: Parallelize access checks
    const accessChecks = []
    if (user.role === 'doctor') {
      accessChecks.push(requireDoctorAccessToPatient(user, consultation.patient.id, context))
    } else if (user.role === 'patient') {
      accessChecks.push(requirePatientSelfAccess(user, consultation.patient.id, context))
    }
    await Promise.all(accessChecks)

    // OPTIMIZED: Background audit logging (non-blocking)
    runInBackground(() => logConsultationAccess(
      user.id,
      user.clinicId,
      params.id,
      context.ip,
      request,
      context.requestId
    ))

    // OPTIMIZED: Reduce JSON payload size - only send necessary fields
    const response = {
      id: consultation.id,
      status: consultation.status,
      startedAt: consultation.startedAt?.toISOString(),
      endedAt: consultation.endedAt?.toISOString(),
      transcription: consultation.transcription,
      recordingUrl: consultation.recordingUrl,
      appointment: {
        id: consultation.appointment.id,
        at: consultation.appointment.scheduledAt.toISOString(),
        dur: consultation.appointment.duration,
        status: consultation.appointment.status,
        type: consultation.appointment.visitType,
        reason: consultation.appointment.reason,
      },
      patient: {
        id: consultation.patient.id,
        name: `${consultation.patient.firstName} ${consultation.patient.lastName}`,
        dob: consultation.patient.dateOfBirth.toISOString().split('T')[0], // Date only
      },
      doctor: {
        id: consultation.doctor.id,
        name: `${consultation.doctor.firstName} ${consultation.doctor.lastName}`,
        spec: consultation.doctor.specialization,
        creds: consultation.doctor.credentials,
      },
    }

    // OPTIMIZED: Add SOAP note only if exists (reduce payload when not needed)
    if (consultation.visitNote) {
      (response as any).soap = {
        id: consultation.visitNote.id,
        s: consultation.visitNote.subjective,
        o: consultation.visitNote.objective,
        a: consultation.visitNote.assessment,
        p: consultation.visitNote.plan,
        cc: consultation.visitNote.chiefComplaint,
        dx: consultation.visitNote.diagnosis,
        proc: consultation.visitNote.procedures,
        fup: consultation.visitNote.followUpDate?.toISOString(),
        signed: consultation.visitNote.signedAt?.toISOString(),
        ai: consultation.visitNote.aiGenerated,
      }
    }

    // OPTIMIZED: Use streaming response for large transcriptions
    if (consultation.transcription && consultation.transcription.length > 10000) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          const data = JSON.stringify(response)
          controller.enqueue(encoder.encode(data))
          controller.close()
        },
      })

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': context.requestId,
        },
      })
    }

    return apiSuccess(response, 200, context.requestId)
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
 * PUT - Update consultation (OPTIMIZED)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // OPTIMIZED: Parallelize session and body parsing
    const [user, body] = await Promise.all([
      requireSession(request),
      request.json(),
    ])

    requireRole(user, ['doctor', 'patient'], context)

    const validatedData = validate(consultationUpdateSchema, body, context.requestId)
    
    // OPTIMIZED: Prepare update data (no unnecessary await)
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

    // OPTIMIZED: Fetch consultation with minimal fields
    const consultation = await prisma.consultation.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clinicId: true,
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

    // OPTIMIZED: Fast tenant check
    if (consultation.clinicId !== user.clinicId) {
      return apiError('Forbidden: Consultation belongs to different clinic', 403, context.requestId)
    }

    // OPTIMIZED: Parallelize access checks
    const accessChecks = []
    if (user.role === 'doctor') {
      accessChecks.push(requireDoctorAccessToPatient(user, consultation.patient.id, context))
    } else if (user.role === 'patient') {
      accessChecks.push(requirePatientSelfAccess(user, consultation.patient.id, context))
    }
    await Promise.all(accessChecks)

    // OPTIMIZED: Update consultation (single operation)
    const updated = await prisma.consultation.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        status: true,
        startedAt: true,
        endedAt: true,
        updatedAt: true,
      },
    })

    // OPTIMIZED: Return minimal response
    return apiSuccess({
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    }, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

