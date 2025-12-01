// TODO: Patient appointments API
// TODO: Get appointments for authenticated patient
// TODO: Filter by status
// TODO: Include doctor information

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { withClinicScope } from '@/lib/auth/tenant-scope'
import { prisma } from '@/db/prisma'
import { appointmentSelect } from '@/lib/db/selects'

// GET - Get patient appointments
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
      // Doctor accessing specific patient's appointments
      await ensureOwnershipOrDoctor(session, patientIdParam, context)
      patientId = patientIdParam
    } else if (session.role === 'patient') {
      // Patient accessing their own appointments
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

    const status = request.nextUrl.searchParams.get('status')
    const upcoming = request.nextUrl.searchParams.get('upcoming') === 'true'

    const where: any = {
      patientId,
    }

    if (status) {
      where.status = status
    } else if (upcoming) {
      where.status = { in: ['SCHEDULED', 'CONFIRMED'] }
      where.scheduledAt = { gte: new Date() }
    }

    // Get appointments with clinic scoping using safe select
    const appointments = await prisma.appointment.findMany({
      where: withClinicScope(session.clinicId, where),
      select: {
        id: true,
        scheduledAt: true,
        duration: true,
        status: true,
        visitType: true,
        reason: true,
        meetingUrl: true,
        createdAt: true,
        doctor: {
          select: {
            id: true,
            specialization: true,
            credentials: true,
          },
        },
        visitNote: {
          select: {
            id: true,
          },
        },
      },
      orderBy: upcoming ? { scheduledAt: 'asc' } : { scheduledAt: 'desc' },
    })

    // Format response (already sanitized by select)
    return apiSuccess(appointments, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

