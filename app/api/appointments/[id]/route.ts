/**
 * Appointment API Route - World-Class Access Control Example
 * 
 * Demonstrates comprehensive RBAC for appointment management
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
import { updateAppointmentSchema } from '@/lib/validation/schemas'
import { prisma } from '@/db/prisma'
import { appointmentSelect } from '@/lib/db/selects'

/**
 * GET - Get appointment details
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

    // OPTIMIZED: Fetch appointment with minimal SELECT and clinicId validation
    const appointment = await prisma.appointment.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clinicId: true, // Include clinicId directly for faster tenant check
        patientId: true,
        doctorId: true,
        ...appointmentSelect,
        patient: {
          select: {
            id: true,
            clinicId: true,
          },
        },
      },
    })

    if (!appointment) {
      return apiError('Appointment not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation using clinicId from appointment directly
    if (appointment.clinicId !== user.clinicId) {
      return apiError('Forbidden: Appointment belongs to different clinic', 403, context.requestId)
    }

    // 5. Patient assignment check based on role
    if (user.role === 'doctor') {
      // Doctor must have relationship with patient
      await requireDoctorAccessToPatient(user, appointment.patient.id, context)
    } else if (user.role === 'patient') {
      // Patient must own the appointment
      await requirePatientSelfAccess(user, appointment.patient.id, context)
    }

    // 6. PHI access logged automatically in guards above

    return apiSuccess(appointment, 200, context.requestId)
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
 * PUT - Update appointment
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session
    const user = await requireSession(request)

    // 2. Require role check (doctors can update, patients can update their own)
    requireRole(user, ['doctor', 'patient'], context)

    const body = await request.json()
    const validatedData = validate(updateAppointmentSchema, body, context.requestId)

    // OPTIMIZED: Fetch appointment with minimal SELECT and clinicId validation
    const appointment = await prisma.appointment.findUnique({
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

    if (!appointment) {
      return apiError('Appointment not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation using clinicId from appointment directly
    if (appointment.clinicId !== user.clinicId) {
      return apiError('Forbidden: Appointment belongs to different clinic', 403, context.requestId)
    }

    // 5. Patient assignment check
    if (user.role === 'doctor') {
      await requireDoctorAccessToPatient(user, appointment.patient.id, context)
    } else if (user.role === 'patient') {
      await requirePatientSelfAccess(user, appointment.patient.id, context)
      // Patients can only update certain fields (e.g., cancellation)
      if (validatedData.status && validatedData.status !== 'CANCELLED') {
        return apiError('Patients can only cancel appointments', 403, context.requestId)
      }
    }

    // 6. Update appointment
    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: validatedData,
      select: appointmentSelect,
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

