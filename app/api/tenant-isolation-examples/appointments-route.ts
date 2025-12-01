/**
 * Appointment API Route - Full Tenant Isolation Example
 * 
 * Demonstrates tenant isolation enforcement for appointments
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import {
  requireSession,
  requireRole,
  getGuardContext,
} from '@/lib/auth/guards'
import {
  enforceTenant,
  enforceTenantWithUser,
  withTenantScope,
  withTenantCreateData,
} from '@/lib/auth/tenant'
import { prisma } from '@/db/prisma'
import { z } from 'zod'

const CreateAppointmentSchema = z.object({
  doctorId: z.string(),
  patientId: z.string(),
  scheduledAt: z.string().datetime(),
  duration: z.number().int().positive().optional(),
  visitType: z.enum(['VIDEO', 'PHONE', 'IN_PERSON', 'CHAT']).optional(),
  reason: z.string().optional(),
})

/**
 * GET - List appointments with tenant isolation
 */
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)

  try {
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)

    // ALL queries MUST include clinicId filter
    const appointments = await prisma.appointment.findMany({
      where: withTenantScope(user.clinicId, {
        // Additional filters
        ...(request.nextUrl.searchParams.get('status') && {
          status: request.nextUrl.searchParams.get('status') as any,
        }),
        ...(user.role === 'patient' && {
          patient: {
            userId: user.id,
            clinicId: user.clinicId, // Double-enforce tenant isolation
          },
        }),
        ...(user.role === 'doctor' && {
          doctor: {
            userId: user.id,
            clinicId: user.clinicId, // Double-enforce tenant isolation
          },
        }),
      }),
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clinicId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            specialization: true,
            clinicId: true,
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    })

    // Verify all results belong to user's clinic
    appointments.forEach((appointment) => {
      enforceTenant(appointment.clinicId, user.clinicId, context)
      enforceTenant(appointment.patient.clinicId, user.clinicId, context)
      enforceTenant(appointment.doctor.clinicId, user.clinicId, context)
    })

    return apiSuccess(appointments, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    return apiError(error.message || 'Internal server error', statusCode, context.requestId)
  }
}

/**
 * POST - Create appointment with tenant isolation
 */
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)

  try {
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)

    const body = await request.json()
    const validatedData = CreateAppointmentSchema.parse(body)

    // 1. Verify doctor belongs to user's clinic
    const doctor = await prisma.doctor.findUnique({
      where: {
        id: validatedData.doctorId,
        clinicId: user.clinicId, // Tenant isolation enforced in query
      },
      select: { id: true, clinicId: true },
    })

    if (!doctor) {
      return apiError('Doctor not found or access denied', 404, context.requestId)
    }

    enforceTenant(doctor.clinicId, user.clinicId, context)

    // 2. Verify patient belongs to user's clinic
    const patient = await prisma.patient.findUnique({
      where: {
        id: validatedData.patientId,
        clinicId: user.clinicId, // Tenant isolation enforced in query
      },
      select: { id: true, clinicId: true },
    })

    if (!patient) {
      return apiError('Patient not found or access denied', 404, context.requestId)
    }

    enforceTenant(patient.clinicId, user.clinicId, context)

    // 3. Create appointment with automatic clinicId
    const appointment = await prisma.appointment.create({
      data: withTenantCreateData(user.clinicId, {
        doctorId: validatedData.doctorId,
        patientId: validatedData.patientId,
        scheduledAt: new Date(validatedData.scheduledAt),
        duration: validatedData.duration || 30,
        visitType: validatedData.visitType || 'VIDEO',
        reason: validatedData.reason,
        status: 'SCHEDULED',
      }),
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, specialization: true } },
      },
    })

    // 4. Verify created resource
    enforceTenant(appointment.clinicId, user.clinicId, context)

    return apiSuccess(appointment, 201, context.requestId)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400, context.requestId)
    }
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    return apiError(error.message || 'Internal server error', statusCode, context.requestId)
  }
}

