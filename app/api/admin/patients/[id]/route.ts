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

    const patientId = params.id

    // Get patient details
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        appointments: {
          take: 10,
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
        consultations: {
          take: 10,
          orderBy: { createdAt: "desc" },
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
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            createdAt: true,
            followUpDate: true,
          },
        },
        intakeForms: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
          },
        },
        labOrders: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            testName: true,
            status: true,
            createdAt: true,
          },
        },
        medications: {
          take: 10,
          orderBy: { startDate: "desc" },
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
        messages: {
          take: 5,
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            updatedAt: true,
          },
        },
      },
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    // Verify clinic access
    if (patient.clinicId !== user.clinicId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // Get auth user data
    const supabase = await createClient()
    const { data: authUser } = await supabase.auth.admin.getUserById(
      patient.userId
    )

    // Count totals
    const appointmentCount = await prisma.appointment.count({
      where: { patientId },
    })

    const messageCount = await prisma.messageThread.count({
      where: { patientId },
    })

    // Get assigned doctor (from most recent appointment)
    const mostRecentAppointment = await prisma.appointment.findFirst({
      where: { patientId },
      orderBy: { scheduledAt: "desc" },
      include: {
        doctor: {
          select: {
            id: true,
            specialization: true,
          },
        },
      },
    })

    return NextResponse.json({
      ...patient,
      email: patient.email || authUser?.user?.email || "Unknown",
      appointmentCount,
      messageCount,
      assignedDoctor: mostRecentAppointment?.doctor || null,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching patient details:", error)
    return NextResponse.json(
      { error: "Failed to fetch patient details" },
      { status: 500 }
    )
  }
}

