import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    // Get all unique clinic IDs from various tables
    // Since there's no Clinic model yet, we'll aggregate from existing data
    const clinicIds = new Set<string>()

    // Get clinic IDs from different sources
    const doctors = await prisma.doctor.findMany({
      select: { clinicId: true },
      distinct: ["clinicId"],
    })
    doctors.forEach((d) => clinicIds.add(d.clinicId))

    const patients = await prisma.patient.findMany({
      select: { clinicId: true },
      distinct: ["clinicId"],
    })
    patients.forEach((p) => clinicIds.add(p.clinicId))

    // Aggregate clinic data
    const clinics = await Promise.all(
      Array.from(clinicIds).map(async (clinicId) => {
        // Get metrics for this clinic
        const [totalPatients, totalDoctors, appointments, consultations] =
          await Promise.all([
            prisma.patient.count({
              where: { clinicId },
            }),
            prisma.doctor.count({
              where: { clinicId },
            }),
            prisma.appointment.findMany({
              where: {
                clinicId,
                scheduledAt: {
                  gte: startOfMonth(new Date()),
                  lte: endOfMonth(new Date()),
                },
              },
              select: { id: true },
            }),
            prisma.consultation.findMany({
              where: {
                clinicId,
                createdAt: {
                  gte: startOfMonth(new Date()),
                  lte: endOfMonth(new Date()),
                },
              },
              select: { id: true },
            }),
          ])

        // Get clinic name from first doctor or patient (or use ID as fallback)
        const firstDoctor = await prisma.doctor.findFirst({
          where: { clinicId },
          select: { clinicId: true },
        })

        return {
          id: clinicId,
          name: clinicId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || clinicId,
          totalPatients,
          totalDoctors,
          monthlyVisits: consultations.length,
          monthlyAppointments: appointments.length,
        }
      })
    )

    return NextResponse.json({ clinics })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching clinics:", error)
    return NextResponse.json(
      { error: "Failed to fetch clinics" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const body = await request.json()
    const { name, clinicId, defaultVisitDuration, specialtiesEnabled, aiNoteTemplates } = body

    // For now, clinics are identified by clinicId strings
    // In a full implementation, you'd create a Clinic record here
    // TODO: Create Clinic model and implement full CRUD

    return NextResponse.json({
      success: true,
      message: "Clinic created (implementation pending Clinic model)",
      clinic: {
        id: clinicId || `clinic-${Date.now()}`,
        name,
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error creating clinic:", error)
    return NextResponse.json(
      { error: "Failed to create clinic" },
      { status: 500 }
    )
  }
}

