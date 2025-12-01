/**
 * OPTIMIZED Appointments API Route - Minimal Latency
 * 
 * Optimizations:
 * - Parallelized independent queries
 * - Removed unnecessary awaits
 * - Reduced JSON payload size
 * - Background audit logging
 * - Minimal SELECT lists
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import {
  requireSession,
  requireRole,
  requireClinicAccess,
  requireDoctorAccessToPatient,
  requirePatientSelfAccess,
  getGuardContext,
} from '@/lib/auth/guards'
import { validate } from '@/lib/validation'
import { createAppointmentSchema } from '@/lib/validation/schemas'
import { prisma } from '@/db/prisma'
import { appointmentSelect } from '@/lib/db/selects'
import { runInBackground } from '@/lib/utils/background-tasks'
import { logAccess } from '@/lib/logging/audit'

// GET - List appointments with filtering (OPTIMIZED)
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)

    const status = request.nextUrl.searchParams.get('status')
    const patientId = request.nextUrl.searchParams.get('patientId')
    const doctorId = request.nextUrl.searchParams.get('doctorId')
    const startDate = request.nextUrl.searchParams.get('startDate')
    const endDate = request.nextUrl.searchParams.get('endDate')

    // Build optimized WHERE clause
    const where: any = {
      clinicId: user.clinicId, // Tenant isolation in WHERE clause
    }

    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId
    if (startDate || endDate) {
      where.scheduledAt = {}
      if (startDate) where.scheduledAt.gte = new Date(startDate)
      if (endDate) where.scheduledAt.lte = new Date(endDate)
    }

    // OPTIMIZED: Single query with minimal SELECT (no unnecessary fields)
    const appointments = await prisma.appointment.findMany({
      where,
      select: {
        id: true,
        scheduledAt: true,
        duration: true,
        status: true,
        visitType: true,
        reason: true,
        doctor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            specialization: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 100, // Limit results for performance
    })

    // OPTIMIZED: Return minimal JSON payload (remove nulls, reduce nesting)
    const response = appointments.map(apt => ({
      id: apt.id,
      at: apt.scheduledAt.toISOString(),
      dur: apt.duration,
      status: apt.status,
      type: apt.visitType,
      reason: apt.reason,
      doctor: `${apt.doctor.firstName} ${apt.doctor.lastName}`,
      doctorId: apt.doctor.id,
      patient: `${apt.patient.firstName} ${apt.patient.lastName}`,
      patientId: apt.patient.id,
    }))

    return apiSuccess(response, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    return apiError(message, statusCode, context.requestId)
  }
}

// POST - Create appointment (OPTIMIZED)
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)

  try {
    // OPTIMIZED: Parallelize session and body parsing (where possible)
    const [user, body] = await Promise.all([
      requireSession(request),
      request.json(), // JSON parsing is async
    ])
    
    requireRole(user, ['doctor', 'patient'], context)

    const validatedData = validate(createAppointmentSchema, body, context.requestId)
    const scheduledAt = typeof validatedData.scheduledAt === 'string' 
      ? new Date(validatedData.scheduledAt)
      : validatedData.scheduledAt

    // OPTIMIZED: Batch all validation queries in parallel
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({
        where: { 
          id: validatedData.patientId,
          clinicId: user.clinicId,
        },
        select: { id: true, clinicId: true },
      }),
      prisma.doctor.findUnique({
        where: { 
          id: validatedData.doctorId,
          clinicId: user.clinicId,
        },
        select: { id: true, clinicId: true },
      }),
    ])

    if (!patient) {
      return apiError('Patient not found', 404, context.requestId)
    }

    if (!doctor) {
      return apiError('Doctor not found', 404, context.requestId)
    }

    // OPTIMIZED: Parallelize access checks where possible
    const accessChecks = []
    accessChecks.push(requireClinicAccess(user, patient.clinicId, 'appointment', 'new', context))
    
    if (user.role === 'doctor') {
      accessChecks.push(requireDoctorAccessToPatient(user, validatedData.patientId, context))
    } else if (user.role === 'patient') {
      accessChecks.push(requirePatientSelfAccess(user, validatedData.patientId, context))
    }
    
    await Promise.all(accessChecks)

    if (doctor.clinicId !== patient.clinicId) {
      return apiError('Doctor and patient must belong to the same clinic', 403, context.requestId)
    }

    // OPTIMIZED: Create appointment (single operation, no unnecessary awaits)
    const appointment = await prisma.appointment.create({
      data: {
        doctorId: validatedData.doctorId,
        patientId: validatedData.patientId,
        clinicId: user.clinicId,
        scheduledAt,
        duration: validatedData.duration,
        status: validatedData.status,
        visitType: validatedData.visitType,
        reason: validatedData.reason,
        notes: validatedData.notes,
        meetingUrl: validatedData.meetingUrl || null,
        meetingId: validatedData.meetingId || null,
      },
      select: {
        id: true,
        scheduledAt: true,
        duration: true,
        status: true,
        visitType: true,
        reason: true,
        doctorId: true,
        patientId: true,
      },
    })

    // OPTIMIZED: Background audit logging (non-blocking)
    runInBackground(() => logAccess({
      userId: user.id,
      clinicId: user.clinicId,
      action: 'APPOINTMENT_CREATED',
      resourceType: 'appointment',
      resourceId: appointment.id,
      ip: context.ip,
      timestamp: new Date(),
    }))

    // OPTIMIZED: Return minimal response payload
    return apiSuccess({
      id: appointment.id,
      at: appointment.scheduledAt.toISOString(),
      status: appointment.status,
    }, 201, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

