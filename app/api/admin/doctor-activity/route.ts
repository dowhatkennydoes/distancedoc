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

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "5", 10)

    // Get recent consultations (which represent doctor activity)
    const recentConsultations = await prisma.consultation.findMany({
      where: {
        clinicId: user.clinicId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
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
          },
        },
        appointment: {
          select: {
            id: true,
          },
        },
      },
    })

    // Get recent SOAP notes (doctor activity)
    const recentSOAPNotes = await prisma.visitNote.findMany({
      where: {
        clinicId: user.clinicId,
        soapNote: {
          not: null,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        consultation: {
          include: {
            doctor: {
              select: {
                specialization: true,
              },
            },
            patient: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    })

    // Combine and format activities
    const activities = []

    // Add consultations
    for (const consultation of recentConsultations) {
      const doctorName = `Dr. ${consultation.doctor?.specialization || "Unknown"}`
      const patientName = consultation.patient
        ? `${consultation.patient.firstName} ${consultation.patient.lastName}`
        : "Unknown Patient"

      activities.push({
        id: `consultation-${consultation.id}`,
        doctor: doctorName,
        action: "Completed consultation",
        patient: patientName,
        timestamp: consultation.createdAt,
      })
    }

    // Add SOAP notes
    for (const note of recentSOAPNotes) {
      const doctorName = `Dr. ${note.consultation?.doctor?.specialization || "Unknown"}`
      const patientName = note.consultation?.patient
        ? `${note.consultation.patient.firstName} ${note.consultation.patient.lastName}`
        : "Unknown Patient"

      activities.push({
        id: `soap-${note.id}`,
        doctor: doctorName,
        action: "Generated SOAP note",
        patient: patientName,
        timestamp: note.createdAt,
      })
    }

    // Sort by timestamp and limit
    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return NextResponse.json(activities.slice(0, limit))
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching doctor activity:", error)
    return NextResponse.json(
      { error: "Failed to fetch doctor activity" },
      { status: 500 }
    )
  }
}

