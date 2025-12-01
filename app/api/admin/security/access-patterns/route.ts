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
    const days = parseInt(searchParams.get("days") || "7", 10)
    const userId = searchParams.get("userId") || undefined

    const firestore = getFirestore()
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Query audit logs for user access patterns
    const auditLogsRef = firestore.collection("audit_logs")
    let query: any = auditLogsRef
      .where("timestamp", ">=", cutoffDate)
      .orderBy("timestamp", "desc")

    if (userId) {
      query = query.where("userId", "==", userId)
    }

    const snapshot = await query.limit(10000).get()

    // Process access patterns
    const logs = snapshot.docs.map((doc) => {
      const data = doc.data()
      return {
        userId: data.userId || null,
        action: data.action || "UNKNOWN",
        resourceType: data.metadata?.resourceType || data.resourceType || null,
        timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp || new Date().toISOString(),
        ip: data.ipAddress || data.ip || "Unknown",
        success: data.success !== undefined ? data.success : true,
      }
    })

    // Aggregate patterns
    const patterns = {
      byUser: aggregateByUser(logs),
      byAction: aggregateByAction(logs),
      byResourceType: aggregateByResourceType(logs),
      byHour: aggregateByHour(logs),
      byDay: aggregateByDay(logs),
      topUsers: getTopUsers(logs),
      suspiciousPatterns: detectSuspiciousPatterns(logs),
    }

    return NextResponse.json({
      patterns,
      totalLogs: logs.length,
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
    console.error("Error fetching access patterns:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch access patterns" },
      { status: 500 }
    )
  }
}

function aggregateByUser(logs: any[]): Record<string, number> {
  const counts: Record<string, number> = {}
  logs.forEach((log) => {
    if (log.userId) {
      counts[log.userId] = (counts[log.userId] || 0) + 1
    }
  })
  return counts
}

function aggregateByAction(logs: any[]): Record<string, number> {
  const counts: Record<string, number> = {}
  logs.forEach((log) => {
    counts[log.action] = (counts[log.action] || 0) + 1
  })
  return counts
}

function aggregateByResourceType(logs: any[]): Record<string, number> {
  const counts: Record<string, number> = {}
  logs.forEach((log) => {
    if (log.resourceType) {
      counts[log.resourceType] = (counts[log.resourceType] || 0) + 1
    }
  })
  return counts
}

function aggregateByHour(logs: any[]): Array<{ hour: number; count: number }> {
  const hourCounts = new Array(24).fill(0)
  logs.forEach((log) => {
    const hour = new Date(log.timestamp).getHours()
    hourCounts[hour]++
  })
  return hourCounts.map((count, hour) => ({ hour, count }))
}

function aggregateByDay(logs: any[]): Array<{ day: string; count: number }> {
  const dayCounts: Record<string, number> = {}
  logs.forEach((log) => {
    const day = new Date(log.timestamp).toISOString().split("T")[0]
    dayCounts[day] = (dayCounts[day] || 0) + 1
  })
  return Object.entries(dayCounts)
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => a.day.localeCompare(b.day))
}

function getTopUsers(logs: any[], limit: number = 10): Array<{ userId: string; count: number }> {
  const userCounts: Record<string, number> = {}
  logs.forEach((log) => {
    if (log.userId) {
      userCounts[log.userId] = (userCounts[log.userId] || 0) + 1
    }
  })
  return Object.entries(userCounts)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function detectSuspiciousPatterns(logs: any[]): Array<{
  type: string
  description: string
  severity: "low" | "medium" | "high"
  count: number
}> {
  const patterns: Array<{
    type: string
    description: string
    severity: "low" | "medium" | "high"
    count: number
  }> = []

  // Pattern 1: High failure rate
  const failures = logs.filter((log) => !log.success).length
  const failureRate = logs.length > 0 ? (failures / logs.length) * 100 : 0
  if (failureRate > 10) {
    patterns.push({
      type: "HIGH_FAILURE_RATE",
      description: `${failureRate.toFixed(1)}% of actions failed`,
      severity: failureRate > 30 ? "high" : failureRate > 20 ? "medium" : "low",
      count: failures,
    })
  }

  // Pattern 2: Rapid access from multiple IPs (same user)
  const userIPs: Record<string, Set<string>> = {}
  logs.forEach((log) => {
    if (log.userId && log.ip) {
      if (!userIPs[log.userId]) {
        userIPs[log.userId] = new Set()
      }
      userIPs[log.userId].add(log.ip)
    }
  })
  Object.entries(userIPs).forEach(([userId, ips]) => {
    if (ips.size > 5) {
      patterns.push({
        type: "MULTIPLE_IPS",
        description: `User ${userId.slice(0, 8)} accessed from ${ips.size} different IPs`,
        severity: ips.size > 10 ? "high" : "medium",
        count: ips.size,
      })
    }
  })

  // Pattern 3: Unusual access times (outside business hours)
  const unusualHours = logs.filter((log) => {
    const hour = new Date(log.timestamp).getHours()
    return hour < 6 || hour > 22 // Outside 6 AM - 10 PM
  }).length
  if (unusualHours > logs.length * 0.2) {
    patterns.push({
      type: "UNUSUAL_HOURS",
      description: `${((unusualHours / logs.length) * 100).toFixed(1)}% of access outside business hours`,
      severity: "low",
      count: unusualHours,
    })
  }

  return patterns
}

