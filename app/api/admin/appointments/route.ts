import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const doctorId = searchParams.get("doctorId") || "all"
    const status = searchParams.get("status") || "all"
    const clinicId = searchParams.get("clinicId") || user.clinicId
    const viewMode = searchParams.get("viewMode") || "month" // day, week, month
    const selectedDate = searchParams.get("selectedDate")
      ? new Date(searchParams.get("selectedDate")!)
      : new Date()
    const page = parseInt(searchParams.get("page") || "1", 10)
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const skip = (page - 1) * limit

    // Build date range based on view mode
    let startDate: Date
    let endDate: Date

    switch (viewMode) {
      case "day":
        startDate = startOfDay(selectedDate)
        endDate = endOfDay(selectedDate)
        break
      case "week":
        startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
        endDate = endOfWeek(selectedDate, { weekStartsOn: 1 })
        break
      case "month":
        startDate = startOfMonth(selectedDate)
        endDate = endOfMonth(selectedDate)
        break
      default:
        startDate = new Date(2020, 0, 1)
        endDate = new Date(2100, 0, 1)
    }

    // Build where clause
    const where: any = {
      clinicId: clinicId === "all" ? user.clinicId : clinicId,
      scheduledAt: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Filter by doctor
    if (doctorId !== "all") {
      where.doctorId = doctorId
    }

    // Filter by status
    if (status !== "all") {
      if (status === "upcoming") {
        where.status = { in: ["SCHEDULED", "CONFIRMED"] }
        where.scheduledAt = {
          ...where.scheduledAt,
          gte: new Date(), // Only future appointments
        }
      } else if (status === "completed") {
        where.status = "COMPLETED"
      } else if (status === "canceled") {
        where.status = "CANCELLED"
      } else {
        where.status = status
      }
    }

    // Get appointments from database
    const appointments = await prisma.appointment.findMany({
      where,
      skip: viewMode !== "all" ? 0 : skip, // Skip pagination for calendar views
      take: viewMode !== "all" ? 1000 : limit, // Get all for calendar views
      orderBy: {
        scheduledAt: "asc",
      },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
          },
        },
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        consultation: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            endedAt: true,
          },
        },
        visitNote: {
          select: {
            id: true,
            createdAt: true,
          },
        },
      },
    })

    // Get total count for pagination (only for table view)
    const total =
      viewMode === "all"
        ? await prisma.appointment.count({
            where: {
              clinicId: clinicId === "all" ? user.clinicId : clinicId,
            },
          })
        : appointments.length

    return NextResponse.json({
      appointments: appointments.map((apt) => ({
        id: apt.id,
        scheduledAt: apt.scheduledAt,
        duration: apt.duration,
        status: apt.status,
        visitType: apt.visitType,
        reason: apt.reason,
        notes: apt.notes,
        meetingUrl: apt.meetingUrl,
        doctor: {
          id: apt.doctor.id,
          name: apt.doctor.specialization || "Doctor",
          specialization: apt.doctor.specialization,
        },
        patient: {
          id: apt.patient.id,
          name: `${apt.patient.firstName} ${apt.patient.lastName}`,
          firstName: apt.patient.firstName,
          lastName: apt.patient.lastName,
          phone: apt.patient.phone,
          email: apt.patient.email,
        },
        consultation: apt.consultation,
        visitNote: apt.visitNote,
        createdAt: apt.createdAt,
        cancelledAt: apt.cancelledAt,
        completedAt: apt.completedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      dateRange: {
        start: startDate,
        end: endDate,
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching appointments:", error)
    return NextResponse.json(
      { error: "Failed to fetch appointments" },
      { status: 500 }
    )
  }
}

