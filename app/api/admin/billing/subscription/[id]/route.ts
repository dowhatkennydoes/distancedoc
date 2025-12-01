import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { stripe } from "@/lib/stripe"
import { z } from "zod"

const updateSubscriptionSchema = z.object({
  action: z.enum(["upgrade", "downgrade", "cancel", "resume"]),
  priceId: z.string().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const subscriptionId = params.id
    const body = await request.json()
    const { action, priceId, cancelAtPeriodEnd } = updateSubscriptionSchema.parse(body)

    let subscription

    switch (action) {
      case "upgrade":
      case "downgrade": {
        if (!priceId) {
          return NextResponse.json(
            { error: "priceId is required for upgrade/downgrade" },
            { status: 400 }
          )
        }

        // Get current subscription
        const currentSub = await stripe.subscriptions.retrieve(subscriptionId)

        // Update subscription with new price
        subscription = await stripe.subscriptions.update(subscriptionId, {
          items: [
            {
              id: currentSub.items.data[0].id,
              price: priceId,
            },
          ],
          proration_behavior: "always_invoice",
        })

        break
      }

      case "cancel": {
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: cancelAtPeriodEnd !== undefined ? cancelAtPeriodEnd : true,
        })
        break
      }

      case "resume": {
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        })
        break
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
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
    console.error("Error updating subscription:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update subscription" },
      { status: 500 }
    )
  }
}

