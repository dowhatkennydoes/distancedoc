// TODO: Doctor billing API
// TODO: Get doctor earnings, payments, subscription status
// TODO: Handle refunds

import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-protection"
import { requireSession, requireRole, getGuardContext } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"

// GET - Get doctor billing data
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError("Doctor account pending approval", 403, context.requestId)
    }

    // Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.id },
      include: {
        appointments: {
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
          },
        },
      },
    })

    if (!doctor) {
      return apiError("Doctor profile not found", 404, context.requestId)
    }

    // Get all payments for appointments with this doctor
    const appointmentIds = doctor.appointments.map((apt) => apt.id)
    
    const payments = await prisma.payment.findMany({
      where: {
        appointmentId: { in: appointmentIds },
      },
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
        appointment: {
          select: {
            id: true,
            scheduledAt: true,
            visitType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    // Calculate earnings
    const totalEarnings = payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const pendingEarnings = payments
      .filter((p) => p.status === "PENDING" || p.status === "PROCESSING")
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const refundedAmount = payments
      .filter((p) => p.status === "REFUNDED")
      .reduce((sum, p) => sum + Number(p.amount), 0)

    // Format payments for response
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      patientName: `${payment.patient.user.firstName} ${payment.patient.user.lastName}`.trim() || payment.patient.user.email,
      patientEmail: payment.patient.user.email,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      description: payment.description || (payment.appointment ? `Appointment - ${payment.appointment.visitType}` : "Payment"),
      appointmentId: payment.appointmentId,
      appointmentDate: payment.appointment?.scheduledAt,
      stripePaymentId: payment.stripePaymentId,
      receiptUrl: payment.receiptUrl,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    }))

    // TODO: Get subscription status from Stripe
    // For now, return placeholder data
    const subscriptionStatus = {
      active: true,
      plan: "Professional",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      stripeCustomerId: null, // TODO: Get from doctor record or Stripe
    }

    return apiSuccess(
      {
        totalEarnings,
        pendingEarnings,
        refundedAmount,
        payments: formattedPayments,
        subscriptionStatus,
        stats: {
          totalPayments: payments.length,
          completedPayments: payments.filter((p) => p.status === "COMPLETED").length,
          pendingPayments: payments.filter((p) => p.status === "PENDING" || p.status === "PROCESSING").length,
          refundedPayments: payments.filter((p) => p.status === "REFUNDED").length,
        },
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || "Internal server error"
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// POST - Process refund
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError("Doctor account pending approval", 403, context.requestId)
    }

    const body = await request.json()
    const { paymentId, reason } = body

    if (!paymentId) {
      return apiError("Payment ID is required", 400, context.requestId)
    }

    // Get payment
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        appointment: {
          include: {
            doctor: {
              select: { id: true, userId: true },
            },
          },
        },
      },
    })

    if (!payment) {
      return apiError("Payment not found", 404, context.requestId)
    }

    // Verify doctor owns this payment (through appointment)
    if (!payment.appointment || payment.appointment.doctor.userId !== session.id) {
      return apiError("Unauthorized", 403, context.requestId)
    }

    if (payment.status !== "COMPLETED") {
      return apiError("Only completed payments can be refunded", 400, context.requestId)
    }

    // TODO: Process refund through Stripe
    // For now, just update the status
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: "REFUNDED",
        description: payment.description ? `${payment.description} (Refunded: ${reason || "No reason provided"})` : `Refunded: ${reason || "No reason provided"}`,
      },
    })

    return apiSuccess(
      {
        success: true,
        payment: {
          id: updatedPayment.id,
          status: updatedPayment.status,
        },
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || "Internal server error"
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

