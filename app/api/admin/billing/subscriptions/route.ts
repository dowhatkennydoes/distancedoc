import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { stripe } from "@/lib/stripe"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status") || "all"
    const limit = parseInt(searchParams.get("limit") || "100", 10)

    // Build subscription list params
    const params: any = {
      limit,
      expand: ["data.customer", "data.items.data.price.product"],
    }

    if (status !== "all") {
      params.status = status
    }

    // Fetch subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list(params)

    // Group by clinic (from metadata)
    const clinicSubscriptions: Record<
      string,
      {
        clinicId: string
        clinicName: string
        subscriptions: any[]
        totalMRR: number
        status: string
      }
    > = {}

    subscriptions.data.forEach((sub) => {
      const clinicId =
        sub.metadata?.clinicId || sub.customer?.metadata?.clinicId || "unknown"
      const clinicName =
        sub.metadata?.clinicName ||
        sub.customer?.metadata?.clinicName ||
        clinicId

      if (!clinicSubscriptions[clinicId]) {
        clinicSubscriptions[clinicId] = {
          clinicId,
          clinicName,
          subscriptions: [],
          totalMRR: 0,
          status: sub.status,
        }
      }

      const mrr =
        sub.items.data[0]?.price?.unit_amount || 0
      clinicSubscriptions[clinicId].subscriptions.push({
        id: sub.id,
        status: sub.status,
        customerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
        customerEmail:
          typeof sub.customer === "object" ? sub.customer?.email : null,
        plan: sub.items.data[0]?.price?.nickname || "Unknown",
        amount: mrr,
        currency: sub.items.data[0]?.price?.currency || "usd",
        currentPeriodStart: new Date(sub.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(sub.current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        canceledAt: sub.canceled_at
          ? new Date(sub.canceled_at * 1000).toISOString()
          : null,
      })

      if (sub.status === "active" || sub.status === "trialing") {
        clinicSubscriptions[clinicId].totalMRR += mrr / 100 // Convert cents to dollars
      }
    })

    return NextResponse.json({
      subscriptions: Object.values(clinicSubscriptions),
      total: subscriptions.data.length,
      hasMore: subscriptions.has_more,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}

