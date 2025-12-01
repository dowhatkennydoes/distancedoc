/**
 * Consultation API Route - Full Tenant Isolation Example
 * 
 * Demonstrates complete tenant isolation enforcement:
 * 1. All queries filtered by clinicId
 * 2. Resource access verified before operations
 * 3. Automatic tenant enforcement on all operations
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
  enforceTenantOnResource,
  withTenantCreateData,
} from '@/lib/auth/tenant'
import { prisma } from '@/db/prisma'
import { z } from 'zod'

const CreateConsultationSchema = z.object({
  appointmentId: z.string(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
})

/**
 * GET - List consultations with full tenant isolation
 */
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)

  try {
    // 1. Require session
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)

    // 2. All queries MUST include clinicId filter
    const consultations = await prisma.consultation.findMany({
      where: withTenantScope(user.clinicId, {
        // Additional filters can be added here
        // clinicId is automatically enforced by withTenantScope
        ...(request.nextUrl.searchParams.get('status') && {
          status: request.nextUrl.searchParams.get('status') as any,
        }),
      }),
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            clinicId: true, // Verify clinicId is included
          },
        },
        doctor: {
          select: {
            id: true,
            specialization: true,
            clinicId: true, // Verify clinicId is included
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // 3. Double-check tenant isolation on results (defense in depth)
    consultations.forEach((consultation) => {
      enforceTenant(consultation.clinicId, user.clinicId, context)
      enforceTenant(consultation.patient.clinicId, user.clinicId, context)
      enforceTenant(consultation.doctor.clinicId, user.clinicId, context)
    })

    return apiSuccess(consultations, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    return apiError(error.message || 'Internal server error', statusCode, context.requestId)
  }
}

/**
 * POST - Create consultation with tenant isolation
 */
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)

  try {
    const user = await requireSession(request)
    requireRole(user, ['doctor'], context)

    const body = await request.json()
    const validatedData = CreateConsultationSchema.parse(body)

    // 1. Verify appointment exists and belongs to user's clinic
    const appointment = await enforceTenantOnResource(
      () =>
        prisma.appointment.findUnique({
          where: { id: validatedData.appointmentId },
          include: {
            patient: { select: { id: true, clinicId: true } },
            doctor: { select: { id: true, clinicId: true } },
          },
        }),
      user,
      'appointment',
      context
    )

    // 2. Verify patient and doctor belong to same clinic
    enforceTenant(appointment.patient.clinicId, user.clinicId, context)
    enforceTenant(appointment.doctor.clinicId, user.clinicId, context)

    // 3. Create consultation with automatic clinicId enforcement
    const consultation = await prisma.consultation.create({
      data: withTenantCreateData(user.clinicId, {
        appointmentId: validatedData.appointmentId,
        doctorId: appointment.doctor.id,
        patientId: appointment.patient.id,
        status: validatedData.status || 'ACTIVE',
      }),
      include: {
        patient: { select: { id: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, specialization: true } },
      },
    })

    // 4. Verify created resource belongs to correct clinic
    enforceTenant(consultation.clinicId, user.clinicId, context)

    return apiSuccess(consultation, 201, context.requestId)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400, context.requestId)
    }
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    return apiError(error.message || 'Internal server error', statusCode, context.requestId)
  }
}

