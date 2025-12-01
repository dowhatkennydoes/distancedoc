import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { createClient } from "@/lib/supabase/server"
import { subDays } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get("search") || ""
    const filter = searchParams.get("filter") || "all" // all, active, at-risk, follow-up, recent
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "25", 10)
    const skip = (page - 1) * limit

    // Build where clause for Prisma
    const where: any = {
      clinicId: user.clinicId,
    }

    // Add search filters
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ]
    }

    // Apply filters
    if (filter === "recent") {
      const thirtyDaysAgo = subDays(new Date(), 30)
      where.createdAt = {
        gte: thirtyDaysAgo,
      }
    }

    // Get patients from database
    const patients = await prisma.patient.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        appointments: {
          take: 1,
          orderBy: { scheduledAt: "desc" },
          include: {
            doctor: {
              select: {
                id: true,
                specialization: true,
              },
            },
          },
        },
        visitNotes: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            followUpDate: true,
            createdAt: true,
          },
        },
      },
    })

    // Get auth users for emails
    const supabase = await createClient()
    const userIds = patients.map((p) => p.userId)

    // Fetch user roles
    const { data: userRoles } = await supabase
      .from("user_roles")
      .select("user_id, role, approved, clinicId")
      .in("user_id", userIds)

    // Get auth users for additional data
    const { data: authUsers } = await supabase.auth.admin.listUsers()

    // Combine data and determine flags
    const patientsWithData = await Promise.all(
      patients.map(async (patient) => {
        const userRole = userRoles?.find((ur) => ur.user_id === patient.userId)
        const authUser = authUsers?.users?.find((au) => au.id === patient.userId)

        // Get most recent appointment to find assigned doctor
        const mostRecentAppointment = patient.appointments[0]
        const assignedDoctor = mostRecentAppointment?.doctor

        // Get most recent visit note for follow-up check
        const mostRecentNote = patient.visitNotes[0]

        // Check for at-risk flags (simplified - you might want to add a dedicated flags field)
        const allergies = patient.allergies as any
        const hasAllergies = allergies && Object.keys(allergies).length > 0

        // Check if follow-up is needed
        const needsFollowUp =
          mostRecentNote?.followUpDate &&
          new Date(mostRecentNote.followUpDate) <= new Date()

        // Check if patient is at-risk (has allergies or other flags)
        const isAtRisk = hasAllergies

        // Get last visit date
        const lastVisit = mostRecentAppointment?.scheduledAt
          ? new Date(mostRecentAppointment.scheduledAt)
          : null

        // Apply filter
        if (filter === "at-risk" && !isAtRisk) {
          return null
        }
        if (filter === "follow-up" && !needsFollowUp) {
          return null
        }

        return {
          id: patient.id,
          userId: patient.userId,
          name: `${patient.firstName} ${patient.lastName}`,
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          phone: patient.phone || "Not provided",
          email: patient.email || authUser?.email || "Unknown",
          assignedDoctor: assignedDoctor
            ? `${assignedDoctor.specialization || "Doctor"}`
            : "Unassigned",
          assignedDoctorId: mostRecentAppointment?.doctorId || null,
          lastVisit: lastVisit,
          isAtRisk: isAtRisk,
          needsFollowUp: needsFollowUp,
          allergies: allergies,
          createdAt: patient.createdAt,
        }
      })
    )

    // Filter out nulls
    const filteredPatients = patientsWithData.filter((p) => p !== null)

    // Get total count for pagination
    const total = await prisma.patient.count({
      where: {
        clinicId: user.clinicId,
      },
    })

    return NextResponse.json({
      patients: filteredPatients,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching patients:", error)
    return NextResponse.json(
      { error: "Failed to fetch patients" },
      { status: 500 }
    )
  }
}

