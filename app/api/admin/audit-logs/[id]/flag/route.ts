import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { getFirestore } from "@/lib/gcp/gcp-firestore"
import { z } from "zod"

const flagSchema = z.object({
  flagged: z.boolean(),
  reason: z.string().optional(),
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

    const logId = params.id
    const body = await request.json()
    const { flagged, reason } = flagSchema.parse(body)

    const firestore = getFirestore()
    const logRef = firestore.collection("audit_logs").doc(logId)

    // Check if log exists
    const logDoc = await logRef.get()
    if (!logDoc.exists) {
      return NextResponse.json(
        { error: "Audit log not found" },
        { status: 404 }
      )
    }

    // Update flag status
    const updateData: any = {
      flagged,
      updatedAt: new Date(),
    }

    if (flagged) {
      updateData.flaggedReason = reason || "Flagged by admin"
      updateData.flaggedBy = user.id
      updateData.flaggedAt = new Date()
    } else {
      updateData.flaggedReason = null
      updateData.flaggedBy = null
      updateData.flaggedAt = null
    }

    await logRef.update(updateData)

    return NextResponse.json({
      success: true,
      message: flagged ? "Log entry flagged as suspicious" : "Flag removed",
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
    console.error("Error flagging audit log:", error)
    return NextResponse.json(
      { error: error.message || "Failed to flag audit log" },
      { status: 500 }
    )
  }
}

