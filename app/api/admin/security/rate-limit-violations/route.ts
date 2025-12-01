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
    const days = parseInt(searchParams.get("days") || "30", 10)
    const limit = parseInt(searchParams.get("limit") || "100", 10)

    const firestore = getFirestore()
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Query audit logs for rate limit violations
    const auditLogsRef = firestore.collection("audit_logs")
    const snapshot = await auditLogsRef
      .where("action", "==", "RATE_LIMIT_VIOLATION")
      .where("timestamp", ">=", cutoffDate)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get() as any

    const violations = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
        userId: data.userId || null,
        endpoint: data.metadata?.endpoint || "Unknown",
        limit: data.metadata?.limit || 0,
        ip: data.ipAddress || data.ip || "Unknown",
        userAgent: data.userAgent || "Unknown",
        device: extractDeviceInfo(data.userAgent),
        requestId: data.requestId || null,
      }
    })

    // Aggregate statistics
    const stats = {
      total: violations.length,
      byEndpoint: aggregateByEndpoint(violations),
      byIP: aggregateByIP(violations),
      byUser: aggregateByUser(violations),
    }

    return NextResponse.json({
      violations,
      stats,
      period: {
        days,
        startDate: cutoffDate.toISOString(),
        endDate: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching rate limit violations:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch rate limit violations" },
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

function aggregateByEndpoint(violations: any[]): Array<{ endpoint: string; count: number }> {
  const endpointCounts = new Map<string, number>()
  violations.forEach((v) => {
    endpointCounts.set(v.endpoint, (endpointCounts.get(v.endpoint) || 0) + 1)
  })
  return Array.from(endpointCounts.entries())
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
}

function aggregateByIP(violations: any[]): Array<{ ip: string; count: number }> {
  const ipCounts = new Map<string, number>()
  violations.forEach((v) => {
    ipCounts.set(v.ip, (ipCounts.get(v.ip) || 0) + 1)
  })
  return Array.from(ipCounts.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function aggregateByUser(violations: any[]): Array<{ userId: string; count: number }> {
  const userCounts = new Map<string, number>()
  violations.forEach((v) => {
    if (v.userId) {
      userCounts.set(v.userId, (userCounts.get(v.userId) || 0) + 1)
    }
  })
  return Array.from(userCounts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

