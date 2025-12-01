// TODO: Doctor billing API
// TODO: Get doctor earnings, payments, subscription status
// TODO: Handle refunds

import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-protection"
import { requireSession, requireRole, getGuardContext } from "@/lib/auth/guards"
import { withClinicScope } from "@/lib/auth/tenant-scope"
import { enforceTenant } from "@/lib/auth/tenant"
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

    // OPTIMIZED: Get doctor record with minimal SELECT (removed appointments to avoid over-fetching)
    const doctor = await prisma.doctor.findUnique({
      where: { 
        userId: session.id,
        clinicId: session.clinicId, // Tenant isolation
      },
      select: {
        id: true,
        userId: true,
        clinicId: true,
      },
    })

    if (!doctor) {
      return apiError("Doctor profile not found", 404, context.requestId)
    }

    // OPTIMIZED: Query payments directly with appointment join (no separate appointment query)
    // Get all payments for appointments with this doctor (with clinic scoping)
    const payments = await prisma.payment.findMany({
      where: withClinicScope(session.clinicId, {
        appointment: {
          doctorId: doctor.id,
          clinicId: session.clinicId,
        },
      }),
      select: {
        id: true,
        patientId: true,
        appointmentId: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        stripePaymentId: true,
        receiptUrl: true,
        paidAt: true,
        createdAt: true,
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    // Format payments for response (minimize PHI exposure)
    const formattedPayments = payments.map((payment) => ({
      id: payment.id,
      // SECURITY: Only include minimal patient identifiers, no full email
      patientName: `${payment.patient.firstName} ${payment.patient.lastName}`.trim() || 'Unknown',
      // Removed patientEmail to reduce PHI exposure - only include if absolutely necessary
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

    // Get payment with clinic verification
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        appointment: {
          include: {
            doctor: {
              select: { id: true, userId: true, clinicId: true },
            },
            patient: {
              select: { clinicId: true },
            },
          },
        },
      },
    })

    if (!payment) {
      return apiError("Payment not found", 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation - verify payment belongs to user's clinic
    if (payment.clinicId !== session.clinicId) {
      return apiError("Forbidden: Payment belongs to different clinic", 403, context.requestId)
    }

    // Verify doctor owns this payment (through appointment)
    if (!payment.appointment || payment.appointment.doctor.userId !== session.id) {
      return apiError("Unauthorized", 403, context.requestId)
    }

    // Additional clinic verification through appointment
    if (payment.appointment.doctor.clinicId !== session.clinicId) {
      return apiError("Forbidden: Appointment belongs to different clinic", 403, context.requestId)
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

