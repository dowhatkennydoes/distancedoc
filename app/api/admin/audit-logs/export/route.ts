import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { getFirestore } from "@/lib/gcp/gcp-firestore"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId") || undefined
    const actionType = searchParams.get("actionType") || undefined
    const resourceType = searchParams.get("resourceType") || undefined
    const status = searchParams.get("status") || undefined
    const clinicId = searchParams.get("clinicId") || undefined
    const flagged = searchParams.get("flagged") === "true" ? true : undefined

    const firestore = getFirestore()
    const auditLogsRef = firestore.collection("audit_logs")

    // Build query (similar to GET endpoint but no limit)
    let query: any = auditLogsRef.orderBy("timestamp", "desc").limit(10000) // Max 10k for export

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
    if (flagged !== undefined) {
      query = query.where("flagged", "==", flagged)
    }

    const snapshot = await query.get()

    // Generate CSV
    let csv = "Timestamp,User ID,Clinic ID,Action,Resource Type,Resource ID,IP Address,Device,User Agent,Request ID,Success,Flagged,Flag Reason\n"

    snapshot.docs.forEach((doc) => {
      const data = doc.data()
      const timestamp = data.timestamp?.toDate?.()?.toISOString() || data.timestamp || ""
      const device = extractDeviceInfo(data.userAgent)

      csv += `"${timestamp}","${data.userId || ""}","${data.clinicId || ""}","${data.action || ""}","${data.resourceType || ""}","${data.resourceId || ""}","${data.ip || ""}","${device}","${(data.userAgent || "").replace(/"/g, '""')}","${data.requestId || ""}","${data.success ? "Yes" : "No"}","${data.flagged ? "Yes" : "No"}","${(data.flaggedReason || "").replace(/"/g, '""')}"\n`
    })

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error exporting audit logs:", error)
    return NextResponse.json(
      { error: error.message || "Failed to export audit logs" },
      { status: 500 }
    )
  }
}

function extractDeviceInfo(userAgent?: string): string {
  if (!userAgent) return "Unknown"
  if (userAgent.includes("Mobile")) return "Mobile"
  if (userAgent.includes("Tablet")) return "Tablet"
  return "Desktop"
}

