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
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const days = parseInt(searchParams.get("days") || "30", 10)

    // Get failed payment intents from last N days
    const cutoffDate = Math.floor(
      (Date.now() - days * 24 * 60 * 60 * 1000) / 1000
    )

    const paymentIntents = await stripe.paymentIntents.list({
      limit: 100,
    })

    // Filter for failed payments
    const failed = paymentIntents.data
      .filter(
        (pi) =>
          pi.status === "payment_failed" && pi.created >= cutoffDate
      )
      .slice(0, limit)

    // Get invoices with failed payments
    const invoices = await stripe.invoices.list({
      limit: 100,
      status: "open",
    })

    const failedInvoices = invoices.data.filter(
      (invoice) =>
        invoice.attempt_count > 0 &&
        invoice.amount_due > 0 &&
        invoice.created >= cutoffDate
    )

    // Format response
    const failures = [
      ...failed.map((pi) => ({
        type: "payment_intent" as const,
        id: pi.id,
        customerId: pi.customer,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        lastPaymentError: pi.last_payment_error
          ? {
              message: pi.last_payment_error.message,
              type: pi.last_payment_error.type,
              code: pi.last_payment_error.code,
            }
          : null,
        createdAt: new Date(pi.created * 1000).toISOString(),
        metadata: pi.metadata,
      })),
      ...failedInvoices.map((invoice) => ({
        type: "invoice" as const,
        id: invoice.id,
        customerId: invoice.customer,
        amount: invoice.amount_due,
        currency: invoice.currency,
        status: "open" as const,
        lastPaymentError: null,
        attemptCount: invoice.attempt_count,
        nextPaymentAttempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null,
        createdAt: new Date(invoice.created * 1000).toISOString(),
        metadata: invoice.metadata,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      failures: failures.slice(0, limit),
      total: failures.length,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching payment failures:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch payment failures" },
      { status: 500 }
    )
  }
}

