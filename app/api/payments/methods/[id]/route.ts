// TODO: Delete payment method API
// TODO: Remove Stripe payment method

import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-protection"
import { requireSession, requireRole, requireOwnership, getGuardContext } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"

// DELETE - Remove payment method
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      return apiError("Patient profile not found", 404, context.requestId)
    }

    // Verify ownership
    await requireOwnership(session.id, patient.id, session.role, context)

    // TODO: Delete payment method from Stripe
    // const paymentMethod = await stripe.paymentMethods.detach(params.id)

    return apiSuccess(
      {
        success: true,
        message: "Payment method removed successfully",
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

