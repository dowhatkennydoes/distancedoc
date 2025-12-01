import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const doctorId = params.id

    // Get doctor details
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: {
        availability: {
          orderBy: [
            { dayOfWeek: "asc" },
            { startTime: "asc" },
          ],
        },
        appointments: {
          take: 10,
          orderBy: { scheduledAt: "desc" },
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        consultations: {
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            patient: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        visitNotes: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        labOrders: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        dashboardPreview: true,
      },
    })

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
    }

    // Verify clinic access
    if (doctor.clinicId !== user.clinicId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Get user role and auth data
    const supabase = await createClient()
    const { data: userRole } = await supabase
      .from("user_roles")
      .select("user_id, role, approved, clinicId")
      .eq("user_id", doctor.userId)
      .single()

    const { data: authUser } = await supabase.auth.admin.getUserById(
      doctor.userId
    )

    // Get doctor name from user metadata
    const firstName =
      (authUser?.user?.user_metadata?.firstName as string) || ""
    const lastName =
      (authUser?.user?.user_metadata?.lastName as string) || ""
    const doctorName =
      firstName && lastName
        ? `${firstName} ${lastName}`
        : authUser?.user?.email?.split("@")[0] || "Doctor"

    // Get files uploaded by this doctor (if FileRecord has createdByUserId)
    const files = await prisma.fileRecord.findMany({
      where: {
        clinicId: user.clinicId,
        // Note: FileRecord might need createdByUserId field
      },
      take: 10,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      ...doctor,
      email: authUser?.user?.email || "Unknown",
      name: doctorName,
      approved: userRole?.approved || false,
      files,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching doctor details:", error)
    return NextResponse.json(
      { error: "Failed to fetch doctor details" },
      { status: 500 }
    )
  }
}

