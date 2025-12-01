// TODO: Message threads API
// TODO: Get message threads for authenticated user
// TODO: Include unread counts
// TODO: Include last message

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { withClinicScope } from '@/lib/auth/tenant-scope'
import { prisma } from '@/db/prisma'

// GET - Get message threads
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient or doctor role
    requireRole(session, ['patient', 'doctor'], context)

    // OPTIMIZED: Get patient or doctor record - batch both queries in parallel
    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId, // Tenant isolation
        },
        select: { id: true, clinicId: true },
      }),
      prisma.doctor.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId, // Tenant isolation
        },
        select: { id: true, clinicId: true },
      }),
    ])

    if (!patient && !doctor) {
      return apiError('User profile not found', 404, context.requestId)
    }

    // OPTIMIZED: Single query with optimized SELECT to reduce over-fetching
    let threads
    if (patient) {
      threads = await prisma.messageThread.findMany({
        where: withClinicScope(session.clinicId, { patientId: patient.id }),
        select: {
          id: true,
          subject: true,
          lastMessageAt: true,
          unreadByPatient: true,
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialization: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              senderId: true,
              senderRole: true,
              read: true,
              createdAt: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    } else if (doctor) {
      threads = await prisma.messageThread.findMany({
        where: withClinicScope(session.clinicId, { doctorId: doctor.id }),
        select: {
          id: true,
          subject: true,
          lastMessageAt: true,
          unreadByDoctor: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              senderId: true,
              senderRole: true,
              read: true,
              createdAt: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    }

    // Format response (optimized - no N+1 queries)
    const formatted = threads?.map((thread) => {
      const lastMessage = thread.messages[0]
      const otherParty = patient
        ? {
            name: `${thread.doctor.firstName || ''} ${thread.doctor.lastName || ''}`.trim(),
            specialization: thread.doctor.specialization || null,
          }
        : {
            name: `${thread.patient.firstName || ''} ${thread.patient.lastName || ''}`.trim(),
          }

      // Unread count is boolean flag - calculate from last message if needed
      const unreadCount = (patient ? thread.unreadByPatient : thread.unreadByDoctor) 
        && lastMessage 
        && !lastMessage.read 
        && lastMessage.senderId !== session.id
        ? 1 : 0

      return {
        id: thread.id,
        subject: thread.subject,
        otherParty,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              senderRole: lastMessage.senderRole,
              createdAt: lastMessage.createdAt,
              read: lastMessage.read,
            }
          : null,
        unreadCount,
        lastMessageAt: thread.lastMessageAt,
      }
    }) || []

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

