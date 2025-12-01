import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { startOfMonth, endOfMonth } from "date-fns"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const clinicId = params.id

    // Get detailed clinic information
    const [totalPatients, totalDoctors, appointments, consultations, doctors] =
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
          select: { id: true, scheduledAt: true },
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
        prisma.doctor.findMany({
          where: { clinicId },
          select: {
            id: true,
            specialization: true,
          },
        }),
      ])

    // Get clinic settings (would be stored in a ClinicSettings table or similar)
    // For now, return default values
    const settings = {
      defaultVisitDuration: 30, // minutes
      specialtiesEnabled: doctors
        .map((d) => d.specialization)
        .filter((s): s is string => s !== null),
      aiNoteTemplates: [], // TODO: Implement AI note templates storage
    }

    return NextResponse.json({
      id: clinicId,
      name: clinicId.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) || clinicId,
      totalPatients,
      totalDoctors,
      monthlyVisits: consultations.length,
      monthlyAppointments: appointments.length,
      doctors: doctors.map((d) => ({
        id: d.id,
        specialization: d.specialization,
      })),
      settings,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching clinic details:", error)
    return NextResponse.json(
      { error: "Failed to fetch clinic details" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const clinicId = params.id
    const body = await request.json()

    // TODO: Update clinic information when Clinic model is created
    // For now, this is a placeholder

    return NextResponse.json({
      success: true,
      message: "Clinic updated (implementation pending Clinic model)",
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error updating clinic:", error)
    return NextResponse.json(
      { error: "Failed to update clinic" },
      { status: 500 }
    )
  }
}

