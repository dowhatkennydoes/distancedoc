// TODO: Patient visit notes API
// TODO: Get visit summaries for patient
// TODO: Include SOAP note data
// TODO: Read-only access

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, requireOwnership, getGuardContext } from '@/lib/auth/guards'
import { prisma } from '@/db/prisma'

// GET - Get patient visit notes
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient role
    requireRole(session, 'patient', context)

    // Get patient record
    const patient = await prisma.patient.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    if (!patient) {
      return apiError('Patient profile not found', 404, context.requestId)
    }

    // Verify ownership - patient can only access their own visit notes
    await requireOwnership(session.id, patient.id, session.role, context)

    const visitNotes = await prisma.visitNote.findMany({
      where: { patientId: patient.id },
      include: {
        appointment: {
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
          },
        },
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
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format response
    const formatted = visitNotes.map((note) => ({
      id: note.id,
      appointmentId: note.appointmentId,
      appointmentDate: note.appointment.scheduledAt,
      doctor: {
        name: `${note.doctor.user.firstName || ''} ${note.doctor.user.lastName || ''}`.trim() || note.doctor.user.email,
        specialization: note.doctor.specialization,
      },
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      chiefComplaint: note.chiefComplaint,
      diagnosis: note.diagnosis,
      procedures: note.procedures,
      followUpDate: note.followUpDate,
      signedAt: note.signedAt,
      createdAt: note.createdAt,
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

