// TODO: Patient payments API
// TODO: Get payment history for authenticated patient
// TODO: Connect to Stripe
// TODO: Include receipt URLs

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, requireOwnership, getGuardContext } from '@/lib/auth/guards'
import { withClinicScope } from '@/lib/auth/tenant-scope'
import { prisma } from '@/db/prisma'

// GET - Get patient payments
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

    // Verify ownership - patient can only access their own payments
    await requireOwnership(session.id, patient.id, session.role, context)

    // Get payments with clinic scoping (through patient)
    const payments = await prisma.payment.findMany({
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
      },
      orderBy: { createdAt: 'desc' },
    })

    // Format response
    const formatted = payments.map((payment) => ({
      id: payment.id,
      amount: payment.amount.toNumber(),
      currency: payment.currency,
      status: payment.status,
      description: payment.description || (payment.appointment
        ? `Consultation - ${payment.appointment.doctor.user.firstName || ''} ${payment.appointment.doctor.user.lastName || ''}`.trim() || payment.appointment.doctor.user.email
        : 'Payment'),
      appointmentId: payment.appointmentId,
      paidAt: payment.paidAt,
      receiptUrl: payment.receiptUrl,
      createdAt: payment.createdAt,
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

