import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { createClient } from "@/lib/supabase/server"

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

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const status = searchParams.get("status") || "all" // all, active, suspended, pending
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "25", 10)
    const skip = (page - 1) * limit

    // Build where clause for Prisma
    const where: any = {
      clinicId: user.clinicId,
    }

    // Add search filters (name, specialty, email via userId)
    if (search) {
      // We'll need to join with user_roles or query separately
      // For now, search by specialization
      where.OR = [
        { specialization: { contains: search, mode: "insensitive" } },
        { licenseNumber: { contains: search, mode: "insensitive" } },
        { npiNumber: { contains: search, mode: "insensitive" } },
      ]
    }

    // Get doctors from database
    const doctors = await prisma.doctor.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        availability: {
          select: {
            dayOfWeek: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    })

    // Get user_roles data to check approval status and emails
    const supabase = await createClient()
    const userIds = doctors.map((d) => d.userId)

    // Fetch user roles and auth user data
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role, approved, clinicId")
      .in("user_id", userIds)

    // Get auth users for email addresses
    const { data: authUsers } = await supabase.auth.admin.listUsers()

    // Combine data
    const doctorsWithStatus = doctors.map((doctor) => {
      const userRole = userRoles?.find((ur) => ur.user_id === doctor.userId)
      const authUser = authUsers?.users?.find((au) => au.id === doctor.userId)

      // Determine status based on approval
      let doctorStatus = "active"
      if (!userRole?.approved) {
        doctorStatus = "pending"
      }
      // Note: suspended status would need to be stored in a separate field or table

      // Apply status filter
      if (status !== "all" && doctorStatus !== status) {
        return null
      }

      // Get doctor name from user metadata or email
      const firstName =
        (authUser?.user_metadata?.firstName as string) ||
        authUser?.user_metadata?.firstName ||
        ""
      const lastName =
        (authUser?.user_metadata?.lastName as string) ||
        authUser?.user_metadata?.lastName ||
        ""
      const doctorName =
        firstName && lastName
          ? `${firstName} ${lastName}`
          : authUser?.email?.split("@")[0] || "Doctor"

      return {
        id: doctor.id,
        userId: doctor.userId,
        email: authUser?.email || "Unknown",
        name: doctorName,
        specialization: doctor.specialization || "Not specified",
        licenseNumber: doctor.licenseNumber,
        npiNumber: doctor.npiNumber || "Not provided",
        status: doctorStatus,
        clinicId: doctor.clinicId,
        credentials: doctor.credentials,
        languages: doctor.languages,
        timezone: doctor.timezone,
        createdAt: doctor.createdAt,
        approved: userRole?.approved || false,
        availability: doctor.availability,
      }
    })

    // Filter out nulls and apply status filter in memory if needed
    let filteredDoctors = doctorsWithStatus.filter((d) => d !== null)

    // If search includes email, filter by email
    if (search) {
      const searchLower = search.toLowerCase()
      filteredDoctors = filteredDoctors.filter((doctor) => {
        if (!doctor) return false
        return (
          doctor.email.toLowerCase().includes(searchLower) ||
          doctor.name.toLowerCase().includes(searchLower) ||
          doctor.specialization.toLowerCase().includes(searchLower) ||
          doctor.licenseNumber.toLowerCase().includes(searchLower)
        )
      })
    }

    // Get total count for pagination
    const total = await prisma.doctor.count({
      where: {
        clinicId: user.clinicId,
      },
    })

    return NextResponse.json({
      doctors: filteredDoctors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    // Requirement 2: Never return 500 - return controlled 200 with error
    console.error("Error fetching doctors:", error)
    return NextResponse.json(
      {
        allowed: true,
        error: "Failed to fetch doctors",
        reason: "internal_error",
      },
      { status: 200 } // Always return 200, never 500
    )
  }
}

