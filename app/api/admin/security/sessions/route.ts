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

    const firestore = getFirestore()
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Query audit logs for session events
    const auditLogsRef = firestore.collection("audit_logs")

    // Get login events
    const loginEvents = await auditLogsRef
      .where("action", "==", "LOGIN_SUCCESS")
      .where("timestamp", ">=", cutoffDate)
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get()

    // Get logout events
    const logoutEvents = await auditLogsRef
      .where("action", "==", "LOGOUT")
      .where("timestamp", ">=", cutoffDate)
      .orderBy("timestamp", "desc")
      .limit(1000)
      .get()

    // Process session data
    const sessions = loginEvents.docs.map((doc) => {
      const data = doc.data()
      const loginTime = data.timestamp?.toDate?.() || new Date(data.timestamp)
      
      // Find corresponding logout if exists
      const logout = logoutEvents.docs.find((logoutDoc) => {
        const logoutData = logoutDoc.data()
        return logoutData.userId === data.userId && logoutData.timestamp?.toDate?.() > loginTime
      })

      const logoutTime = logout?.data()?.timestamp?.toDate?.() || null
      const duration = logoutTime ? logoutTime.getTime() - loginTime.getTime() : null

      return {
        id: doc.id,
        userId: data.userId || null,
        loginTime: loginTime.toISOString(),
        logoutTime: logoutTime?.toISOString() || null,
        duration: duration ? Math.round(duration / 1000 / 60) : null, // minutes
        ip: data.ipAddress || data.ip || "Unknown",
        userAgent: data.userAgent || "Unknown",
        expired: !logoutTime && (Date.now() - loginTime.getTime()) > 24 * 60 * 60 * 1000, // 24 hours
      }
    })

    // Calculate expiration statistics
    const expiredSessions = sessions.filter((s) => s.expired).length
    const activeSessions = sessions.filter((s) => !s.logoutTime && !s.expired).length
    const avgDuration = sessions
      .filter((s) => s.duration !== null)
      .reduce((sum, s) => sum + (s.duration || 0), 0) /
      (sessions.filter((s) => s.duration !== null).length || 1)

    return NextResponse.json({
      sessions,
      statistics: {
        total: sessions.length,
        active: activeSessions,
        expired: expiredSessions,
        completed: sessions.filter((s) => s.logoutTime !== null).length,
        averageDurationMinutes: Math.round(avgDuration),
      },
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
    console.error("Error fetching session data:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch session data" },
      { status: 500 }
    )
  }
}

