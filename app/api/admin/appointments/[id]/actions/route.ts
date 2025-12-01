import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { z } from "zod"
import { AppointmentStatus } from "@prisma/client"

const actionSchema = z.object({
  action: z.enum(["reschedule", "reassign", "cancel"]),
  appointmentId: z.string(),
  scheduledAt: z.string().optional(), // ISO date string for reschedule
  doctorId: z.string().optional(), // Required for reassign
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const body = await request.json()
    const { action, appointmentId, scheduledAt, doctorId } = actionSchema.parse(body)

    // Get appointment to verify clinic access
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        clinicId: true,
        status: true,
        scheduledAt: true,
      },
    })

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      )
    }

    if (appointment.clinicId !== user.clinicId) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      )
    }

    switch (action) {
      case "reschedule": {
        if (!scheduledAt) {
          return NextResponse.json(
            { error: "scheduledAt is required for reschedule action" },
            { status: 400 }
          )
        }

        const newDate = new Date(scheduledAt)

        // Update appointment
        const updated = await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            scheduledAt: newDate,
            status: AppointmentStatus.RESCHEDULED,
            updatedAt: new Date(),
          },
        })

        // TODO: Send notification to patient and doctor
        // TODO: Create audit log entry

        return NextResponse.json({
          success: true,
          message: "Appointment rescheduled successfully",
          appointment: updated,
        })
      }

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
          return NextResponse.json(
            { error: "Doctor not found" },
            { status: 404 }
          )
        }

        if (doctor.clinicId !== user.clinicId) {
          return NextResponse.json(
            { error: "Doctor does not belong to your clinic" },
            { status: 403 }
          )
        }

        // Update appointment
        const updated = await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            doctorId: doctorId,
            updatedAt: new Date(),
          },
        })

        // TODO: Send notification to new doctor and patient
        // TODO: Create audit log entry

        return NextResponse.json({
          success: true,
          message: "Appointment reassigned successfully",
          appointment: updated,
        })
      }

      case "cancel": {
        // Cancel appointment
        const updated = await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            status: AppointmentStatus.CANCELLED,
            cancelledAt: new Date(),
            updatedAt: new Date(),
          },
        })

        // TODO: Send cancellation notification to patient and doctor
        // TODO: Create audit log entry

        return NextResponse.json({
          success: true,
          message: "Appointment cancelled successfully",
          appointment: updated,
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
    console.error("Error performing appointment action:", error)
    return NextResponse.json(
      { error: error.message || "Failed to perform action" },
      { status: 500 }
    )
  }
}

