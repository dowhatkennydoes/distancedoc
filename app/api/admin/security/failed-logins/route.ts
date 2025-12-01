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

    // Query audit logs for failed login attempts
    const auditLogsRef = firestore.collection("audit_logs")
    const snapshot = await auditLogsRef
      .where("action", "==", "LOGIN_FAILURE")
      .where("timestamp", ">=", cutoffDate)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get() as any as any

    const failedLogins = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
        email: data.metadata?.attemptedEmail || "Unknown",
        ip: data.ipAddress || data.ip || "Unknown",
        userAgent: data.userAgent || "Unknown",
        reason: data.metadata?.reason || "Invalid credentials",
        device: extractDeviceInfo(data.userAgent),
        requestId: data.requestId || null,
      }
    })

    // Aggregate statistics
    const stats = {
      total: failedLogins.length,
      uniqueIPs: new Set(failedLogins.map((f) => f.ip)).size,
      uniqueEmails: new Set(failedLogins.map((f) => f.email)).size,
      byIP: aggregateByIP(failedLogins),
      byEmail: aggregateByEmail(failedLogins),
    }

    return NextResponse.json({
      failedLogins,
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
    console.error("Error fetching failed logins:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch failed logins" },
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

function aggregateByIP(logins: any[]): Array<{ ip: string; count: number }> {
  const ipCounts = new Map<string, number>()
  logins.forEach((login) => {
    ipCounts.set(login.ip, (ipCounts.get(login.ip) || 0) + 1)
  })
  return Array.from(ipCounts.entries())
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

function aggregateByEmail(logins: any[]): Array<{ email: string; count: number }> {
  const emailCounts = new Map<string, number>()
  logins.forEach((login) => {
    const email = login.email !== "Unknown" ? login.email : "Unknown"
    emailCounts.set(email, (emailCounts.get(email) || 0) + 1)
  })
  return Array.from(emailCounts.entries())
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

