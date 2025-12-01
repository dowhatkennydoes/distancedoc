import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    // TODO: Query actual MFA enrollment data from Supabase or database
    // For now, return mock structure that matches expected format

    // This would query from Supabase auth.mfa_factors table or similar
    // const { createClient } = await import("@/lib/supabase/server")
    // const supabase = await createClient()
    // const { data: mfaFactors } = await supabase.auth.admin.listMFAFactors()

    // Get total user count
    const totalUsers = await prisma.doctor.count() + (await prisma.patient.count())

    // Mock MFA stats (replace with actual query)
    const mfaStats = {
      totalUsers,
      enrolledUsers: Math.floor(totalUsers * 0.35), // Mock 35% enrollment
      enrollmentRate: 0,
      byRole: {
        doctors: {
          total: await prisma.doctor.count(),
          enrolled: Math.floor((await prisma.doctor.count()) * 0.5), // Mock 50%
        },
        patients: {
          total: await prisma.patient.count(),
          enrolled: Math.floor((await prisma.patient.count()) * 0.2), // Mock 20%
        },
        admins: {
          total: 1, // Assuming 1 admin
          enrolled: 1, // Admin should have MFA
        },
      },
      enrollmentTrend: [
        // Mock trend data
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], enrolled: 10 },
        { date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], enrolled: 15 },
        { date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], enrolled: 20 },
        { date: new Date().toISOString().split("T")[0], enrolled: Math.floor(totalUsers * 0.35) },
      ],
    }

    mfaStats.enrollmentRate = totalUsers > 0
      ? Math.round((mfaStats.enrolledUsers / totalUsers) * 100)
      : 0

    return NextResponse.json(mfaStats)
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching MFA stats:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch MFA stats" },
      { status: 500 }
    )
  }
}

