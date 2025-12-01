import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { z } from "zod"

const settingsSchema = z.object({
  defaultVisitDuration: z.number().min(15).max(120).optional(),
  specialtiesEnabled: z.array(z.string()).optional(),
  aiNoteTemplates: z.array(z.string()).optional(),
})

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
    const settings = settingsSchema.parse(body)

    // TODO: Store clinic settings in a ClinicSettings table
    // For now, this is a placeholder that would store settings
    // Options:
    // 1. Create a ClinicSettings model
    // 2. Store in a JSON column in a Clinic model
    // 3. Store in a key-value settings table

    return NextResponse.json({
      success: true,
      message: "Clinic settings updated (implementation pending ClinicSettings model)",
      settings,
    })
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
    console.error("Error updating clinic settings:", error)
    return NextResponse.json(
      { error: "Failed to update clinic settings" },
      { status: 500 }
    )
  }
}

