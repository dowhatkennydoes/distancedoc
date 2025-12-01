import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth/guards"
import { getFirestore } from "@/lib/gcp/gcp-firestore"
import type { Firestore } from "@google-cloud/firestore"

export async function GET(request: NextRequest) {
  // Requirement 2: Return controlled 200 with { allowed: false, reason } - Never 401 or 500
  const adminCheck = await requireAdmin(request)
  
  if (!adminCheck.allowed) {
    return NextResponse.json(
      {
        allowed: false,
        reason: adminCheck.reason || "unauthenticated",
      },
      { status: 200 } // Always return 200, never 401 or 500
    )
  }

  // User is guaranteed to be admin here
  const user = adminCheck.user!
  
  try {

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId") || undefined
    const actionType = searchParams.get("actionType") || undefined
    const resourceType = searchParams.get("resourceType") || undefined
    const status = searchParams.get("status") || undefined
    const clinicId = searchParams.get("clinicId") || undefined
    const limit = parseInt(searchParams.get("limit") || "100", 10)
    const startAfter = searchParams.get("startAfter") || undefined

    const firestore = getFirestore()
    const auditLogsRef = firestore.collection("audit_logs")

    // Build query
    let query: any = auditLogsRef.orderBy("timestamp", "desc").limit(limit)

    // Apply filters
    if (userId) {
      query = query.where("userId", "==", userId)
    }
    if (clinicId) {
      query = query.where("clinicId", "==", clinicId)
    }
    if (actionType) {
      query = query.where("action", "==", actionType)
    }
    if (resourceType) {
      query = query.where("resourceType", "==", resourceType)
    }
    if (status !== undefined) {
      query = query.where("success", "==", status === "success")
    }

    // Handle pagination
    if (startAfter) {
      const startAfterDoc = await firestore.collection("audit_logs").doc(startAfter).get()
      if (startAfterDoc.exists) {
        query = query.startAfter(startAfterDoc)
      }
    }

    // Execute query
    const snapshot = await query.get()

    const logs = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        userId: data.userId,
        clinicId: data.clinicId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        ip: data.ip || "unknown",
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
        userAgent: data.userAgent,
        requestId: data.requestId,
        success: data.success !== undefined ? data.success : true,
        flagged: data.flagged || false,
        flaggedReason: data.flaggedReason || null,
        flaggedBy: data.flaggedBy || null,
        flaggedAt: data.flaggedAt?.toDate?.()?.toISOString() || null,
        metadata: data.metadata || {},
        device: extractDeviceInfo(data.userAgent),
      }
    })

    return NextResponse.json({
      logs,
      hasMore: snapshot.docs.length === limit,
      nextStartAfter: snapshot.docs[snapshot.docs.length - 1]?.id,
    })
  } catch (error: any) {
    // Requirement 2: Never return 500 - return controlled 200 with error
    console.error("Error fetching audit logs:", error)
    return NextResponse.json(
      {
        allowed: true,
        error: error.message || "Failed to fetch audit logs",
        reason: "internal_error",
      },
      { status: 200 } // Always return 200, never 500
    )
  }
}

function extractDeviceInfo(userAgent?: string): string {
  if (!userAgent) return "Unknown"

  // Simple device detection
  if (userAgent.includes("Mobile")) {
    return "Mobile"
  }
  if (userAgent.includes("Tablet")) {
    return "Tablet"
  }
  return "Desktop"
}

