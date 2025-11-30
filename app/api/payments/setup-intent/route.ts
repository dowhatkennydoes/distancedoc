// TODO: Create Stripe setup intent for adding payment methods

import { NextRequest } from "next/server"
import { requireAuth, apiError } from "@/lib/auth/api-protection"
import { prisma } from "@/db/prisma"

// TODO: POST - Create setup intent
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)

    // Get patient record
    const patient = await prisma.patient.findUnique({
      where: { userId: user.id },
    })

    if (!patient) {
      return apiError("Patient profile not found", 404)
    }

    // TODO: Create Stripe setup intent
    // const setupIntent = await stripe.setupIntents.create({
    //   customer: patient.stripeCustomerId,
    //   payment_method_types: ['card'],
    // })

    return new Response(
      JSON.stringify({
        clientSecret: null, // setupIntent.client_secret
        message: "Setup intent creation coming soon",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error: any) {
    if (error.message === "Unauthorized") {
      return apiError("Unauthorized", 401)
    }
    return apiError(error.message || "Internal server error", 500)
  }
}

