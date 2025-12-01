import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { subDays, format, startOfDay, endOfDay } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get("days") || "30", 10)
    const startDate = subDays(new Date(), days)

    // Get appointments grouped by date
    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId: user.clinicId,
        scheduledAt: {
          gte: startDate,
        },
      },
      select: {
        scheduledAt: true,
      },
    })

    // Group by date
    const appointmentsByDate = appointments.reduce(
      (acc, appointment) => {
        const dateKey = format(startOfDay(appointment.scheduledAt), "yyyy-MM-dd")
        acc[dateKey] = (acc[dateKey] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    // Generate data for all days in range
    const data = []
    for (let i = days - 1; i >= 0; i--) {
      const date = subDays(new Date(), i)
      const dateKey = format(startOfDay(date), "yyyy-MM-dd")
      data.push({
        date: dateKey,
        value: appointmentsByDate[dateKey] || 0,
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
    console.error("Error fetching appointments over time:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointments data" },
      { status: 500 }
    )
  }
}

