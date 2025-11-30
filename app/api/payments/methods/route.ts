// TODO: Payment methods API
// TODO: Get and manage Stripe payment methods
// TODO: Add, update, delete payment methods

import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-protection"
import { requireSession, requireRole, requireOwnership, getGuardContext } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"

// GET - Get patient payment methods
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
      return apiError("Patient profile not found", 404, context.requestId)
    }

    // Verify ownership
    await requireOwnership(session.id, patient.id, session.role, context)

    // TODO: Fetch payment methods from Stripe
    // For now, return empty array or sample data
    const paymentMethods = []

    return apiSuccess({ paymentMethods }, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || "Internal server error"
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// POST - Create setup intent for adding payment method
export async function POST(request: NextRequest) {
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

    // TODO: Create Stripe setup intent
    // const setupIntent = await stripe.setupIntents.create({
    //   customer: patient.stripeCustomerId,
    // })

    return apiSuccess(
      {
        clientSecret: null, // setupIntent.client_secret
        message: "Setup intent creation coming soon",
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

