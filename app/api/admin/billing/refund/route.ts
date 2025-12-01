import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { stripe } from "@/lib/stripe"
import { z } from "zod"

const refundSchema = z.object({
  paymentIntentId: z.string().optional(),
  chargeId: z.string().optional(),
  amount: z.number().optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
  metadata: z.record(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const body = await request.json()
    const { paymentIntentId, chargeId, amount, reason, metadata } = refundSchema.parse(body)

    if (!paymentIntentId && !chargeId) {
      return NextResponse.json(
        { error: "Either paymentIntentId or chargeId is required" },
        { status: 400 }
      )
    }

    // Create refund
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      charge: chargeId,
      amount: amount ? Math.round(amount * 100) : undefined, // Convert dollars to cents
      reason: reason,
      metadata: metadata || {},
    })

    return NextResponse.json({
      success: true,
      refund: {
        id: refund.id,
        amount: refund.amount / 100, // Convert cents to dollars
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        createdAt: new Date(refund.created * 1000).toISOString(),
      },
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error processing refund:", error)
    return NextResponse.json(
      { error: error.message || "Failed to process refund" },
      { status: 500 }
    )
  }
}

