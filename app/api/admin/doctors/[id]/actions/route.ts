import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const actionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend", "reset_password", "impersonate"]),
  doctorId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const body = await request.json()
    const { action, doctorId } = actionSchema.parse(body)

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

    const supabase = await createClient()

    switch (action) {
      case "approve":
        // Approve doctor in user_roles
        const { error: approveError } = await supabase
          .from("user_roles")
          .update({ approved: true })
          .eq("user_id", doctor.userId)
          .eq("role", "doctor")

        if (approveError) {
          throw new Error(`Failed to approve doctor: ${approveError.message}`)
        }

        // TODO: Send approval notification email
        return NextResponse.json({ success: true, message: "Doctor approved" })

      case "reject":
        // Reject doctor (set approved to false)
        const { error: rejectError } = await supabase
          .from("user_roles")
          .update({ approved: false })
          .eq("user_id", doctor.userId)
          .eq("role", "doctor")

        if (rejectError) {
          throw new Error(`Failed to reject doctor: ${rejectError.message}`)
        }

        // TODO: Send rejection notification email
        return NextResponse.json({ success: true, message: "Doctor rejected" })

      case "suspend":
        // Suspend doctor - add suspended flag (would need to add this to user_roles or separate table)
        // For now, we'll use a metadata field or update approved status
        const { error: suspendError } = await supabase
          .from("user_roles")
          .update({ approved: false }) // Temporarily use approved field
          .eq("user_id", doctor.userId)
          .eq("role", "doctor")

        if (suspendError) {
          throw new Error(`Failed to suspend doctor: ${suspendError.message}`)
        }

        // TODO: Send suspension notification email
        return NextResponse.json({ success: true, message: "Doctor suspended" })

      case "reset_password":
        // Generate password reset link via Supabase
        const { data: resetData, error: resetError } =
          await supabase.auth.admin.generateLink({
            type: "recovery",
            email: (await supabase.auth.admin.getUserById(doctor.userId)).data
              .user?.email || "",
          })

        if (resetError || !resetData?.properties?.action_link) {
          throw new Error(
            `Failed to generate reset link: ${resetError?.message}`
          )
        }

        // TODO: Send password reset email to doctor
        return NextResponse.json({
          success: true,
          resetLink: resetData.properties.action_link,
          message: "Password reset link generated",
        })

      case "impersonate":
        // Dev only - create impersonation token
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Impersonation disabled in production" },
            { status: 403 }
          )
        }

        // Generate impersonation token (would need custom implementation)
        // For now, return the doctor's userId
        return NextResponse.json({
          success: true,
          userId: doctor.userId,
          message: "Impersonation token generated (dev only)",
        })

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
    console.error("Error performing doctor action:", error)
    return NextResponse.json(
      { error: error.message || "Failed to perform action" },
      { status: 500 }
    )
  }
}

