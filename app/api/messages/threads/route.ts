// TODO: Message threads API
// TODO: Get message threads for authenticated user
// TODO: Include unread counts
// TODO: Include last message

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { prisma } from '@/db/prisma'

// GET - Get message threads
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient or doctor role
    requireRole(session, ['patient', 'doctor'], context)

    // Get patient or doctor record
    const patient = await prisma.patient.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    if (!patient && !doctor) {
      return apiError('User profile not found', 404, context.requestId)
    }

    let threads
    if (patient) {
      // Get threads where patient is involved
      threads = await prisma.messageThread.findMany({
        where: { patientId: patient.id },
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
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    } else if (doctor) {
      // Get threads where doctor is involved
      threads = await prisma.messageThread.findMany({
        where: { doctorId: doctor.id },
        include: {
          patient: {
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
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
      })
    }

    // Format response
    const formatted = threads?.map((thread) => {
      const lastMessage = thread.messages[0]
      const otherParty = patient
        ? {
            name: `${thread.doctor.user.firstName || ''} ${thread.doctor.user.lastName || ''}`.trim() || thread.doctor.user.email,
            specialization: thread.doctor.specialization,
          }
        : {
            name: `${thread.patient.user.firstName || ''} ${thread.patient.user.lastName || ''}`.trim() || thread.patient.user.email,
          }

      const unreadCount = patient
        ? thread.unreadByPatient
          ? thread.messages.filter((m) => !m.read && m.senderId !== session.id).length
          : 0
        : thread.unreadByDoctor
        ? thread.messages.filter((m) => !m.read && m.senderId !== session.id).length
        : 0

      return {
        id: thread.id,
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

