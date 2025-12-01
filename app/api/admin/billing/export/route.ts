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
    const type = searchParams.get("type") || "invoices" // invoices, customers, subscriptions
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined

    let csv = ""

    if (type === "invoices") {
      // Export invoices
      csv = "Invoice ID,Number,Customer Email,Amount,Currency,Status,Paid,Period Start,Period End,Created\n"

      const invoices = await stripe.invoices.list({
        limit: 100,
        created:
          startDate && endDate
            ? {
                gte: Math.floor(new Date(startDate).getTime() / 1000),
                lte: Math.floor(new Date(endDate).getTime() / 1000),
              }
            : undefined,
      })

      invoices.data.forEach((invoice) => {
        const customerEmail =
          typeof invoice.customer === "object"
            ? invoice.customer?.email || ""
            : ""
        csv += `${invoice.id},${invoice.number || ""},${customerEmail},${(invoice.total / 100).toFixed(2)},${invoice.currency},${invoice.status},${invoice.paid},${invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : ""},${invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : ""},${new Date(invoice.created * 1000).toISOString()}\n`
      })
    } else if (type === "customers") {
      // Export customers
      csv = "Customer ID,Email,Name,Created,Subscription Status,Plan,MRR\n"

      const customers = await stripe.customers.list({
        limit: 100,
        expand: ["data.subscriptions"],
      })

      customers.data.forEach((customer) => {
        const subscriptions = customer.subscriptions?.data || []
        const activeSubscription = subscriptions.find(
          (sub) => sub.status === "active" || sub.status === "trialing"
        )
        const mrr = activeSubscription?.items.data[0]?.price?.unit_amount || 0

        csv += `${customer.id},${customer.email || ""},${customer.name || ""},${new Date(customer.created * 1000).toISOString()},${activeSubscription?.status || "none"},${activeSubscription?.items.data[0]?.price?.nickname || ""},${(mrr / 100).toFixed(2)}\n`
      })
    } else if (type === "subscriptions") {
      // Export subscriptions
      csv = "Subscription ID,Customer Email,Status,Plan,Amount,Currency,Period Start,Period End,Created\n"

      const subscriptions = await stripe.subscriptions.list({
        limit: 100,
        expand: ["data.customer"],
      })

      subscriptions.data.forEach((sub) => {
        const customerEmail =
          typeof sub.customer === "object" ? sub.customer?.email || "" : ""
        const amount = sub.items.data[0]?.price?.unit_amount || 0

        csv += `${sub.id},${customerEmail},${sub.status},${sub.items.data[0]?.price?.nickname || ""},${(amount / 100).toFixed(2)},${sub.items.data[0]?.price?.currency || "usd"},${new Date(sub.current_period_start * 1000).toISOString()},${new Date(sub.current_period_end * 1000).toISOString()},${new Date(sub.created * 1000).toISOString()}\n`
      })
    }

    // Return CSV file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="billing-export-${type}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error exporting billing data:", error)
    return NextResponse.json(
      { error: error.message || "Failed to export billing data" },
      { status: 500 }
    )
  }
}

