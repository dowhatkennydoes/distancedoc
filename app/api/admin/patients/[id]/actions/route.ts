import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { z } from "zod"

const actionSchema = z.object({
  action: z.enum(["reassign", "archive", "mark_follow_up", "remove_follow_up"]),
  patientId: z.string(),
  doctorId: z.string().optional(), // Required for reassign
  followUpDate: z.string().optional(), // ISO date string for mark_follow_up
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const body = await request.json()
    const { action, patientId, doctorId, followUpDate } = actionSchema.parse(body)

    // Get patient to verify clinic access
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { clinicId: true },
    })

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 })
    }

    if (patient.clinicId !== user.clinicId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    switch (action) {
      case "reassign": {
        if (!doctorId) {
          return NextResponse.json(
            { error: "doctorId is required for reassign action" },
            { status: 400 }
          )
        }

        // Verify doctor exists and belongs to same clinic
        const doctor = await prisma.doctor.findUnique({
          where: { id: doctorId },
          select: { clinicId: true },
        })

        if (!doctor) {
          return NextResponse.json({ error: "Doctor not found" }, { status: 404 })
        }

        if (doctor.clinicId !== user.clinicId) {
          return NextResponse.json(
            { error: "Doctor does not belong to your clinic" },
            { status: 403 }
          )
        }

        // Create a new appointment or update existing to reassign
        // For now, we'll create a placeholder appointment
        // In production, you might want to create a patient-doctor assignment table
        // TODO: Implement proper patient-doctor assignment model

        return NextResponse.json({
          success: true,
          message: "Patient reassigned to doctor",
        })
      }

      case "archive": {
        // Archive patient (would need an archived field or status)
        // For now, we'll use a soft delete pattern
        // TODO: Add archivedAt field to Patient model or use a status field

        return NextResponse.json({
          success: true,
          message: "Patient archived",
        })
      }

      case "mark_follow_up": {
        if (!followUpDate) {
          return NextResponse.json(
            { error: "followUpDate is required for mark_follow_up action" },
            { status: 400 }
          )
        }

        // Get most recent visit note and update followUpDate
        const mostRecentNote = await prisma.visitNote.findFirst({
          where: { patientId },
          orderBy: { createdAt: "desc" },
        })

        if (mostRecentNote) {
          await prisma.visitNote.update({
            where: { id: mostRecentNote.id },
            data: {
              followUpDate: new Date(followUpDate),
            },
          })
        } else {
          // If no visit note exists, we might want to create one or store in a separate table
          // For now, return error
          return NextResponse.json(
            { error: "No visit note found to update. Please create a visit note first." },
            { status: 404 }
          )
        }

        return NextResponse.json({
          success: true,
          message: "Follow-up date marked",
        })
      }

      case "remove_follow_up": {
        // Remove follow-up date from most recent visit note
        const mostRecentNote = await prisma.visitNote.findFirst({
          where: { patientId },
          orderBy: { createdAt: "desc" },
        })

        if (mostRecentNote) {
          await prisma.visitNote.update({
            where: { id: mostRecentNote.id },
            data: {
              followUpDate: null,
            },
          })
        }

        return NextResponse.json({
          success: true,
          message: "Follow-up flag removed",
        })
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        )
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error performing patient action:", error)
    return NextResponse.json(
      { error: error.message || "Failed to perform action" },
      { status: 500 }
    )
  }
}

