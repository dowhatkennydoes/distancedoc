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
    const months = parseInt(searchParams.get("months") || "12", 10)

    // Get all active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: "all",
      limit: 100,
      expand: ["data.items.data.price"],
    })

    // Calculate MRR over time
    const mrrData: Array<{ month: string; mrr: number; new: number; churned: number }> = []
    const now = new Date()

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthKey = date.toISOString().slice(0, 7) // YYYY-MM

      let mrr = 0
      let newMRR = 0
      let churnedMRR = 0

      subscriptions.data.forEach((sub) => {
        const subStart = new Date(sub.created * 1000)
        const subEnd = sub.canceled_at
          ? new Date(sub.canceled_at * 1000)
          : null
        const periodStart = new Date(date.getFullYear(), date.getMonth(), 1)
        const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0)

        // Check if subscription was active during this month
        const wasActive =
          subStart <= periodEnd &&
          (!subEnd || subEnd >= periodStart) &&
          (sub.status === "active" ||
            sub.status === "trialing" ||
            (sub.status === "canceled" && (!subEnd || subEnd > periodStart)))

        if (wasActive) {
          const amount = sub.items.data[0]?.price?.unit_amount || 0
          mrr += amount / 100 // Convert cents to dollars

          // Check if subscription started this month
          if (
            subStart >= periodStart &&
            subStart <= periodEnd &&
            sub.status !== "canceled"
          ) {
            newMRR += amount / 100
          }

          // Check if subscription ended this month
          if (subEnd && subEnd >= periodStart && subEnd <= periodEnd) {
            churnedMRR += amount / 100
          }
        }
      })

      mrrData.push({
        month: monthKey,
        mrr: Math.round(mrr * 100) / 100,
        new: Math.round(newMRR * 100) / 100,
        churned: Math.round(churnedMRR * 100) / 100,
      })
    }

    // Calculate current MRR
    const currentMRR = mrrData[mrrData.length - 1]?.mrr || 0

    return NextResponse.json({
      currentMRR,
      monthlyData: mrrData,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error calculating MRR:", error)
    return NextResponse.json(
      { error: error.message || "Failed to calculate MRR" },
      { status: 500 }
    )
  }
}

