import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { z } from "zod"

const assignDoctorSchema = z.object({
  doctorId: z.string(),
  clinicId: z.string(),
  action: z.enum(["assign", "remove"]),
})

export async function POST(
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
    const { doctorId, action } = assignDoctorSchema.parse({
      ...body,
      clinicId,
    })

    // Get doctor
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

    if (action === "assign") {
      // Assign doctor to clinic
      await prisma.doctor.update({
        where: { id: doctorId },
        data: {
          clinicId: clinicId,
        },
      })

      // Also update user_roles clinicId if needed
      // Note: This would require Supabase admin client to update user_roles
      // For now, the clinicId in the Doctor table is the source of truth

      return NextResponse.json({
        success: true,
        message: "Doctor assigned to clinic successfully",
      })
    } else if (action === "remove") {
      // Remove doctor from clinic (set to default clinic)
      await prisma.doctor.update({
        where: { id: doctorId },
        data: {
          clinicId: "default-clinic",
        },
      })

      return NextResponse.json({
        success: true,
        message: "Doctor removed from clinic successfully",
      })
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    )
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
    console.error("Error assigning doctor to clinic:", error)
    return NextResponse.json(
      { error: "Failed to assign doctor to clinic" },
      { status: 500 }
    )
  }
}

