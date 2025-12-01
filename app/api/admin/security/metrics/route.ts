import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { getFirestore } from "@/lib/gcp/gcp-firestore"
import { prisma } from "@/db/prisma"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const firestore = getFirestore()
    const now = new Date()
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Get failed logins
    const failedLoginsRef = firestore.collection("audit_logs")
    const failedLogins24h = await failedLoginsRef
      .where("action", "==", "LOGIN_FAILURE")
      .where("timestamp", ">=", last24Hours)
      .get()

    const failedLogins30d = await failedLoginsRef
      .where("action", "==", "LOGIN_FAILURE")
      .where("timestamp", ">=", last30Days)
      .get()

    // Get rate limit violations
    const rateLimitViolations24h = await failedLoginsRef
      .where("action", "==", "RATE_LIMIT_VIOLATION")
      .where("timestamp", ">=", last24Hours)
      .get()

    const rateLimitViolations30d = await failedLoginsRef
      .where("action", "==", "RATE_LIMIT_VIOLATION")
      .where("timestamp", ">=", last30Days)
      .get()

    // Get unauthorized access attempts
    const unauthorizedAccess = await failedLoginsRef
      .where("action", "==", "UNAUTHORIZED_ACCESS")
      .where("timestamp", ">=", last7Days)
      .get()

    // Get session expiration info (from audit logs or calculate)
    const activeSessions = await failedLoginsRef
      .where("action", "==", "LOGIN_SUCCESS")
      .where("timestamp", ">=", last24Hours)
      .get()

    // MFA enrollment stats (placeholder - would need MFA table)
    // For now, return mock data structure
    const mfaStats = {
      totalUsers: 0,
      enrolledUsers: 0,
      enrollmentRate: 0,
      // TODO: Query actual MFA enrollment data
    }

    // Calculate security status
    const securityStatus = calculateSecurityStatus({
      failedLogins24h: failedLogins24h.size,
      failedLogins30d: failedLogins30d.size,
      rateLimitViolations24h: rateLimitViolations24h.size,
      rateLimitViolations30d: rateLimitViolations30d.size,
      unauthorizedAccess: unauthorizedAccess.size,
      mfaEnrollmentRate: mfaStats.enrollmentRate,
    })

    return NextResponse.json({
      metrics: {
        failedLogins: {
          last24Hours: failedLogins24h.size,
          last30Days: failedLogins30d.size,
        },
        rateLimitViolations: {
          last24Hours: rateLimitViolations24h.size,
          last30Days: rateLimitViolations30d.size,
        },
        unauthorizedAccess: {
          last7Days: unauthorizedAccess.size,
        },
        activeSessions: {
          last24Hours: activeSessions.size,
        },
        mfa: mfaStats,
      },
      securityStatus,
      period: {
        last24Hours: last24Hours.toISOString(),
        last7Days: last7Days.toISOString(),
        last30Days: last30Days.toISOString(),
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching security metrics:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch security metrics" },
      { status: 500 }
    )
  }
}

function calculateSecurityStatus(metrics: {
  failedLogins24h: number
  failedLogins30d: number
  rateLimitViolations24h: number
  rateLimitViolations30d: number
  unauthorizedAccess: number
  mfaEnrollmentRate: number
}): {
  overall: "good" | "warning" | "critical"
  warnings: Array<{ type: string; message: string; severity: "low" | "medium" | "high" }>
} {
  const warnings: Array<{ type: string; message: string; severity: "low" | "medium" | "high" }> = []

  // Check failed logins
  if (metrics.failedLogins24h > 50) {
    warnings.push({
      type: "HIGH_FAILED_LOGINS",
      message: `${metrics.failedLogins24h} failed login attempts in last 24 hours`,
      severity: "high",
    })
  } else if (metrics.failedLogins24h > 20) {
    warnings.push({
      type: "ELEVATED_FAILED_LOGINS",
      message: `${metrics.failedLogins24h} failed login attempts in last 24 hours`,
      severity: "medium",
    })
  }

  // Check rate limit violations
  if (metrics.rateLimitViolations24h > 100) {
    warnings.push({
      type: "HIGH_RATE_LIMIT_VIOLATIONS",
      message: `${metrics.rateLimitViolations24h} rate limit violations in last 24 hours`,
      severity: "high",
    })
  } else if (metrics.rateLimitViolations24h > 50) {
    warnings.push({
      type: "ELEVATED_RATE_LIMIT_VIOLATIONS",
      message: `${metrics.rateLimitViolations24h} rate limit violations in last 24 hours`,
      severity: "medium",
    })
  }

  // Check unauthorized access
  if (metrics.unauthorizedAccess > 10) {
    warnings.push({
      type: "UNAUTHORIZED_ACCESS_ATTEMPTS",
      message: `${metrics.unauthorizedAccess} unauthorized access attempts in last 7 days`,
      severity: "high",
    })
  }

  // Check MFA enrollment
  if (metrics.mfaEnrollmentRate < 50 && metrics.mfaEnrollmentRate > 0) {
    warnings.push({
      type: "LOW_MFA_ENROLLMENT",
      message: `Only ${metrics.mfaEnrollmentRate}% of users enrolled in MFA`,
      severity: "medium",
    })
  }

  // Determine overall status
  const highSeverityWarnings = warnings.filter((w) => w.severity === "high").length
  const mediumSeverityWarnings = warnings.filter((w) => w.severity === "medium").length

  let overall: "good" | "warning" | "critical" = "good"
  if (highSeverityWarnings > 0) {
    overall = "critical"
  } else if (mediumSeverityWarnings > 2 || warnings.length > 3) {
    overall = "warning"
  }

  return { overall, warnings }
}

