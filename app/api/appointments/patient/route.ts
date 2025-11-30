// TODO: Patient appointments API
// TODO: Get appointments for authenticated patient
// TODO: Filter by status
// TODO: Include doctor information

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, requireOwnership, getGuardContext } from '@/lib/auth/guards'
import { withClinicScope } from '@/lib/auth/tenant-scope'
import { prisma } from '@/db/prisma'

// GET - Get patient appointments
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient role
    requireRole(session, 'patient', context)

    // Get patient record with clinic scoping
    const patient = await prisma.patient.findUnique({
      where: { 
        userId: session.id,
        clinicId: session.clinicId, // Tenant isolation
      },
      select: { id: true, clinicId: true },
    })

    if (!patient) {
      return apiError('Patient profile not found', 404, context.requestId)
    }

    // Verify ownership - patient can only access their own appointments
    await requireOwnership(session.id, patient.id, session.role, context)

    const status = request.nextUrl.searchParams.get('status')
    const upcoming = request.nextUrl.searchParams.get('upcoming') === 'true'

    const where: any = {
      patientId: patient.id,
    }

    if (status) {
      where.status = status
    } else if (upcoming) {
      where.status = { in: ['SCHEDULED', 'CONFIRMED'] }
      where.scheduledAt = { gte: new Date() }
    }

    // Get appointments with clinic scoping
    const appointments = await prisma.appointment.findMany({
      where: withClinicScope(session.clinicId, where),
      include: {
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
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

    // Format response
    const formatted = appointments.map((apt) => ({
      id: apt.id,
      scheduledAt: apt.scheduledAt,
      duration: apt.duration,
      status: apt.status,
      visitType: apt.visitType,
      reason: apt.reason,
      meetingUrl: apt.meetingUrl,
      doctor: {
        id: apt.doctor.id,
        name: `${apt.doctor.user.firstName || ''} ${apt.doctor.user.lastName || ''}`.trim() || apt.doctor.user.email,
        specialization: apt.doctor.specialization,
      },
      visitNote: apt.visitNote ? { id: apt.visitNote.id } : undefined,
    }))

    return apiSuccess(formatted, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

