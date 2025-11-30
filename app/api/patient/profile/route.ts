// TODO: Get patient profile
// TODO: Return patient information for authenticated user

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, requireOwnership, getGuardContext } from '@/lib/auth/guards'
import { prisma } from '@/db/prisma'

export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient role
    requireRole(session, 'patient', context)

    const patient = await prisma.patient.findUnique({
      where: { userId: session.id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!patient) {
      return apiError('Patient profile not found', 404, context.requestId)
    }

    // Verify ownership - patient can only access their own profile
    await requireOwnership(session.id, patient.id, session.role, context)

    return apiSuccess(
      {
        id: patient.id,
        userId: patient.userId,
        email: patient.user.email,
        firstName: patient.user.firstName,
        lastName: patient.user.lastName,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        phoneNumber: patient.phoneNumber,
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

