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
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const startingAfter = searchParams.get("starting_after") || undefined

    // Fetch Stripe customers
    const customers = await stripe.customers.list({
      limit,
      starting_after: startingAfter,
      expand: ["data.subscriptions"],
    })

    // Format response
    const formatted = customers.data.map((customer) => {
      const subscriptions = customer.subscriptions?.data || []
      const activeSubscription = subscriptions.find(
        (sub) => sub.status === "active" || sub.status === "trialing"
      )

      return {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        created: new Date(customer.created * 1000).toISOString(),
        metadata: customer.metadata,
        subscription: activeSubscription
          ? {
              id: activeSubscription.id,
              status: activeSubscription.status,
              currentPeriodEnd: new Date(
                activeSubscription.current_period_end * 1000
              ).toISOString(),
              plan: activeSubscription.items.data[0]?.price?.nickname || "Unknown",
              amount: activeSubscription.items.data[0]?.price?.unit_amount || 0,
              currency: activeSubscription.items.data[0]?.price?.currency || "usd",
            }
          : null,
        subscriptionsCount: subscriptions.length,
      }
    })

    return NextResponse.json({
      customers: formatted,
      hasMore: customers.has_more,
      nextStartingAfter: customers.data[customers.data.length - 1]?.id,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching Stripe customers:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch customers" },
      { status: 500 }
    )
  }
}

