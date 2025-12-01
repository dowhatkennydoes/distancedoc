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
    const customerId = searchParams.get("customerId") || undefined
    const startingAfter = searchParams.get("starting_after") || undefined

    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      limit,
      customer: customerId,
      starting_after: startingAfter,
      expand: ["data.customer", "data.subscription"],
    })

    // Format response
    const formatted = invoices.data.map((invoice) => ({
      id: invoice.id,
      number: invoice.number,
      customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
      customerEmail:
        typeof invoice.customer === "object" ? invoice.customer?.email : null,
      subscriptionId:
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id,
      amount: invoice.total,
      currency: invoice.currency,
      status: invoice.status,
      paid: invoice.paid,
      amountPaid: invoice.amount_paid,
      amountDue: invoice.amount_due,
      periodStart: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      periodEnd: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
      dueDate: invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString()
        : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
      createdAt: new Date(invoice.created * 1000).toISOString(),
      metadata: invoice.metadata,
    }))

    return NextResponse.json({
      invoices: formatted,
      hasMore: invoices.has_more,
      nextStartingAfter: invoices.data[invoices.data.length - 1]?.id,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching invoices:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    )
  }
}

