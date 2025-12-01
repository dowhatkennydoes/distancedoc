/**
 * Messages API Route - Create new message
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { enforceTenant } from '@/lib/auth/tenant'
import { validate } from '@/lib/validation'
import { messageSchema } from '@/lib/validation/schemas'
import { prisma } from '@/db/prisma'

// POST - Create new message
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session
    const session = await requireSession(request)
    requireRole(session, ['doctor', 'patient'], context)

    // 2. Validate request body
    const body = await request.json()
    const validatedData = validate(messageSchema, body, context.requestId)

    // OPTIMIZED: Fetch message thread with clinicId filter and minimal SELECT
    const thread = await prisma.messageThread.findUnique({
      where: { 
        id: validatedData.threadId,
        clinicId: session.clinicId, // Tenant isolation in WHERE clause
      },
      select: {
        id: true,
        clinicId: true,
        doctorId: true,
        patientId: true,
      },
    })

    if (!thread) {
      return apiError('Message thread not found', 404, context.requestId)
    }

    // SECURITY: Tenant isolation already enforced in WHERE clause, but double-check
    enforceTenant(thread.clinicId, session.clinicId, context)

    // OPTIMIZED: Batch user lookups in parallel
    const isPatient = session.role === 'patient'
    const isDoctor = session.role === 'doctor'

    // OPTIMIZED: Validate user is part of thread (batched queries if needed)
    if (isPatient) {
      const patient = await prisma.patient.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!patient || patient.id !== thread.patientId) {
        return apiError('You are not part of this message thread', 403, context.requestId)
      }
    } else if (isDoctor) {
      const doctor = await prisma.doctor.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!doctor || doctor.id !== thread.doctorId) {
        return apiError('You are not part of this message thread', 403, context.requestId)
      }
    }

    // 6. Create message
    const message = await prisma.message.create({
      data: {
        threadId: validatedData.threadId,
        senderId: session.id,
        senderRole: session.role.toUpperCase() as 'DOCTOR' | 'PATIENT',
        content: validatedData.content,
        attachments: validatedData.attachments || [],
      },
    })

    // 7. Update thread last message time and unread flags
    await prisma.messageThread.update({
      where: { id: validatedData.threadId },
      data: {
        lastMessageAt: new Date(),
        unreadByDoctor: isPatient,
        unreadByPatient: isDoctor,
      },
    })

    return apiSuccess(message, 201, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

