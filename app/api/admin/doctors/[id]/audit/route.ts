import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"

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
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "50", 10)

    // Get doctor to verify clinic access
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { userId: true, clinicId: true },
    })

    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
    }

    if (doctor.clinicId !== user.clinicId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    // TODO: Query actual audit logs from audit log system
    // For now, return mock audit events based on doctor activity
    const mockAuditEvents = [
      {
        id: "1",
        action: "LOGIN",
        resourceType: "user",
        resourceId: doctor.userId,
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        details: { location: "New York, US" },
      },
      {
        id: "2",
        action: "CONSULTATION_CREATED",
        resourceType: "consultation",
        resourceId: "consultation-1",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        details: { patientId: "patient-1" },
      },
      {
        id: "3",
        action: "SOAP_NOTE_GENERATED",
        resourceType: "visit_note",
        resourceId: "note-1",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
        ip: "192.168.1.1",
        userAgent: "Mozilla/5.0...",
        details: { aiGenerated: true },
      },
    ]

    return NextResponse.json({
      events: mockAuditEvents.slice(0, limit),
      total: mockAuditEvents.length,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching audit events:", error)
    return NextResponse.json(
      { error: "Failed to fetch audit events" },
      { status: 500 }
    )
  }
}

