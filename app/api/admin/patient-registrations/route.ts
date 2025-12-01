import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const months = parseInt(searchParams.get("months") || "6", 10)

    // Get patient registrations grouped by month
    const patients = await prisma.patient.findMany({
      where: {
        clinicId: user.clinicId,
        createdAt: {
          gte: subMonths(new Date(), months),
        },
      },
      select: {
        createdAt: true,
      },
    })

    // Group by month
    const registrationsByMonth = patients.reduce(
      (acc, patient) => {
        const monthKey = format(startOfMonth(patient.createdAt), "MMM")
        acc[monthKey] = (acc[monthKey] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Generate data for all months in range
    const data = []
    for (let i = months - 1; i >= 0; i--) {
      const month = subMonths(new Date(), i)
      const monthKey = format(startOfMonth(month), "MMM")
      data.push({
        label: monthKey,
        value: registrationsByMonth[monthKey] || 0,
      })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching patient registrations:", error)
    return NextResponse.json(
      { error: "Failed to fetch patient registrations" },
      { status: 500 }
    )
  }
}

