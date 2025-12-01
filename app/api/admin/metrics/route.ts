import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { format, startOfMonth, endOfMonth, isToday } from "date-fns"

export async function GET(request: NextRequest) {
  // Requirement 2: Return controlled 200 with { allowed: false, reason } - Never 401 or 500
  const adminCheck = await requireAdmin(request)
  
  if (!adminCheck.allowed) {
    return NextResponse.json(
      {
        allowed: false,
        reason: adminCheck.reason || "unauthenticated",
      },
      { status: 200 } // Always return 200, never 401 or 500
    )
  }

  // User is guaranteed to be admin here
  const user = adminCheck.user!
  
  try {

    const now = new Date()
    const startOfCurrentMonth = startOfMonth(now)
    const endOfCurrentMonth = endOfMonth(now)

    // Get active doctors count
    const activeDoctors = await prisma.doctor.count({
      where: {
        clinicId: user.clinicId,
        // You might want to add an 'active' field or filter by last activity
      },
    })

    // Get active patients count
    const activePatients = await prisma.patient.count({
      where: {
        clinicId: user.clinicId,
      },
    })

    // Get today's appointments count
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const todayAppointments = await prisma.appointment.count({
      where: {
        clinicId: user.clinicId,
        scheduledAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    })

    // Get monthly revenue from payments (mock for now - integrate Stripe later)
    const monthlyPayments = await prisma.payment.aggregate({
      where: {
        clinicId: user.clinicId,
        createdAt: {
          gte: startOfCurrentMonth,
          lte: endOfCurrentMonth,
        },
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    })

    const monthlyRevenue = monthlyPayments._sum.amount || 0

    // Get pending approvals (doctors with approved = false)
    const pendingApprovals = await prisma.doctor.count({
      where: {
        clinicId: user.clinicId,
        // This would need to join with user_roles, or store approval in Doctor table
      },
    })

    // System uptime (mock - integrate with Cloud Monitoring API later)
    const systemUptime = "99.9%"

    // Calculate trends (simplified - compare to previous month)
    const previousMonthStart = startOfMonth(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    )
    const previousMonthEnd = endOfMonth(
      new Date(now.getFullYear(), now.getMonth() - 1, 1)
    )

    const previousMonthDoctors = await prisma.doctor.count({
      where: {
        clinicId: user.clinicId,
        createdAt: {
          lte: previousMonthEnd,
        },
      },
    })

    const previousMonthPatients = await prisma.patient.count({
      where: {
        clinicId: user.clinicId,
        createdAt: {
          lte: previousMonthEnd,
        },
      },
    })

    const previousMonthRevenue = await prisma.payment.aggregate({
      where: {
        clinicId: user.clinicId,
        createdAt: {
          gte: previousMonthStart,
          lte: previousMonthEnd,
        },
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    })

    const doctorTrend =
      previousMonthDoctors > 0
        ? Math.round(
            ((activeDoctors - previousMonthDoctors) / previousMonthDoctors) * 100
          )
        : 0

    const patientTrend =
      previousMonthPatients > 0
        ? Math.round(
            ((activePatients - previousMonthPatients) / previousMonthPatients) *
              100
          )
        : 0

    const revenueTrend =
      (previousMonthRevenue._sum.amount || 0) > 0
        ? Math.round(
            ((monthlyRevenue - (previousMonthRevenue._sum.amount || 0)) /
              (previousMonthRevenue._sum.amount || 0)) *
              100
          )
        : 0

    return NextResponse.json({
      activeDoctors,
      activePatients,
      todayAppointments,
      monthlyRevenue,
      pendingApprovals,
      systemUptime,
      trends: {
        doctors: {
          value: doctorTrend,
          label: "from last month",
          isPositive: doctorTrend >= 0,
        },
        patients: {
          value: patientTrend,
          label: "from last month",
          isPositive: patientTrend >= 0,
        },
        revenue: {
          value: revenueTrend,
          label: "from last month",
          isPositive: revenueTrend >= 0,
        },
      },
    })
  } catch (error: any) {
    // Requirement 2: Never return 500 - return controlled 200 with error
    console.error("Error fetching admin metrics:", error)
    return NextResponse.json(
      {
        allowed: true,
        error: "Failed to fetch metrics",
        reason: "internal_error",
      },
      { status: 200 } // Always return 200, never 500
    )
  }
}

