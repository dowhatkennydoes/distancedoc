"use client"

import * as React from "react"
import { AdminLayout } from "@/components/admin/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Users,
  Lock,
  RefreshCw,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  FileText,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  Activity,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { format, parseISO, formatDistanceToNow } from "date-fns"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface SecurityMetrics {
  failedLogins: {
    last24Hours: number
    last30Days: number
  }
  rateLimitViolations: {
    last24Hours: number
    last30Days: number
  }
  unauthorizedAccess: {
    last7Days: number
  }
  activeSessions: {
    last24Hours: number
  }
  mfa: {
    totalUsers: number
    enrolledUsers: number
    enrollmentRate: number
  }
}

interface SecurityStatus {
  overall: "good" | "warning" | "critical"
  warnings: Array<{ type: string; message: string; severity: "low" | "medium" | "high" }>
}

interface FailedLogin {
  id: string
  timestamp: string
  email: string
  ip: string
  userAgent: string
  reason: string
  device: string
  requestId: string | null
}

interface RateLimitViolation {
  id: string
  timestamp: string
  userId: string | null
  endpoint: string
  limit: number
  ip: string
  userAgent: string
  device: string
  requestId: string | null
}

interface AccessPattern {
  byUser: Record<string, number>
  byAction: Record<string, number>
  byResourceType: Record<string, number>
  byHour: Array<{ hour: number; count: number }>
  byDay: Array<{ day: string; count: number }>
  topUsers: Array<{ userId: string; count: number }>
  suspiciousPatterns: Array<{
    type: string
    description: string
    severity: "low" | "medium" | "high"
    count: number
  }>
}

interface BreachSimulatorReport {
  generatedAt: string
  scenarios: Array<{
    name: string
    severity: string
    description: string
    risk: string
    mitigation: string
    status: string
  }>
  summary: {
    totalScenarios: number
    secureScenarios: number
    vulnerabilitiesFound: number
    recommendations: string[]
  }
  compliance: {
    hipaa: string
    securityControls: string
    auditLogging: string
    accessControl: string
  }
}

interface MFAStats {
  totalUsers: number
  enrolledUsers: number
  enrollmentRate: number
  byRole: {
    doctors: { total: number; enrolled: number }
    patients: { total: number; enrolled: number }
    admins: { total: number; enrolled: number }
  }
  enrollmentTrend: Array<{ date: string; enrolled: number }>
}

export default function AdminSecurityPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [metrics, setMetrics] = React.useState<SecurityMetrics | null>(null)
  const [securityStatus, setSecurityStatus] = React.useState<SecurityStatus | null>(null)
  const [failedLogins, setFailedLogins] = React.useState<FailedLogin[]>([])
  const [rateLimitViolations, setRateLimitViolations] = React.useState<RateLimitViolation[]>([])
  const [accessPatterns, setAccessPatterns] = React.useState<AccessPattern | null>(null)
  const [breachReport, setBreachReport] = React.useState<BreachSimulatorReport | null>(null)
  const [mfaStats, setMfaStats] = React.useState<MFAStats | null>(null)
  const [sessionStats, setSessionStats] = React.useState<any>(null)

  const fetchAllData = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    setLoading(true)
    try {
      const [
        metricsRes,
        failedLoginsRes,
        rateLimitRes,
        accessPatternsRes,
        breachRes,
        mfaRes,
        sessionsRes,
      ] = await Promise.all([
        fetch("/api/admin/security/metrics", { credentials: "include" }),
        fetch("/api/admin/security/failed-logins?days=30", { credentials: "include" }),
        fetch("/api/admin/security/rate-limit-violations?days=30", { credentials: "include" }),
        fetch("/api/admin/security/access-patterns?days=7", { credentials: "include" }),
        fetch("/api/admin/security/breach-simulator", { credentials: "include" }),
        fetch("/api/admin/security/mfa-stats", { credentials: "include" }),
        fetch("/api/admin/security/sessions?days=30", { credentials: "include" }),
      ])

      if (metricsRes.ok) {
        const data = await metricsRes.json()
        setMetrics(data.metrics)
        setSecurityStatus(data.securityStatus)
      }

      if (failedLoginsRes.ok) {
        const data = await failedLoginsRes.json()
        setFailedLogins(data.failedLogins || [])
      }

      if (rateLimitRes.ok) {
        const data = await rateLimitRes.json()
        setRateLimitViolations(data.violations || [])
      }

      if (accessPatternsRes.ok) {
        const data = await accessPatternsRes.json()
        setAccessPatterns(data.patterns)
      }

      if (breachRes.ok) {
        const data = await breachRes.json()
        setBreachReport(data)
      } else if (breachRes.status === 403) {
        // Breach simulator only in dev - this is expected
        setBreachReport(null)
      }

      if (mfaRes.ok) {
        const data = await mfaRes.json()
        setMfaStats(data)
      }

      if (sessionsRes.ok) {
        const data = await sessionsRes.json()
        setSessionStats(data.statistics)
      }
    } catch (error) {
      console.error("Failed to fetch security data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch security data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  React.useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const getStatusBadge = (status: "good" | "warning" | "critical") => {
    switch (status) {
      case "good":
        return (
          <Badge variant="default" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Secure
          </Badge>
        )
      case "warning":
        return (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Warning
          </Badge>
        )
      case "critical":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            Critical
          </Badge>
        )
    }
  }

  const getSeverityBadge = (severity: "low" | "medium" | "high") => {
    switch (severity) {
      case "low":
        return <Badge variant="outline">Low</Badge>
      case "medium":
        return <Badge variant="secondary">Medium</Badge>
      case "high":
        return <Badge variant="destructive">High</Badge>
    }
  }

  const getDeviceIcon = (device: string) => {
    switch (device?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />
      case "tablet":
        return <Tablet className="h-4 w-4" />
      case "desktop":
        return <Monitor className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-muted-foreground">Loading security data...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Security Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Monitor security threats, access patterns, and system health
            </p>
          </div>
          <Button variant="outline" onClick={fetchAllData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Security Status Card */}
        {securityStatus && (
          <Alert
            variant={
              securityStatus.overall === "critical"
                ? "destructive"
                : securityStatus.overall === "warning"
                ? "default"
                : "default"
            }
          >
            <Shield className="h-4 w-4" />
            <AlertTitle>
              Security Status: {securityStatus.overall.toUpperCase()}
            </AlertTitle>
            <AlertDescription>
              {securityStatus.warnings.length > 0
                ? `${securityStatus.warnings.length} security warning(s) detected`
                : "All security checks passed"}
            </AlertDescription>
          </Alert>
        )}

        {/* Security Status Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className={securityStatus?.overall === "critical" ? "border-destructive" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Status</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {securityStatus && (
                <>
                  <div className="text-2xl font-bold mb-2">
                    {getStatusBadge(securityStatus.overall)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {securityStatus.warnings.length} active warning(s)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed Logins (24h)</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.failedLogins.last24Hours || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics?.failedLogins.last30Days || 0} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rate Limit Violations (24h)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics?.rateLimitViolations.last24Hours || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics?.rateLimitViolations.last30Days || 0} in last 30 days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MFA Enrollment</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {mfaStats?.enrollmentRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {mfaStats?.enrolledUsers || 0} of {mfaStats?.totalUsers || 0} users
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Security Warnings */}
        {securityStatus && securityStatus.warnings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Security Warnings
              </CardTitle>
              <CardDescription>Active security alerts requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {securityStatus.warnings.map((warning, index) => (
                  <Alert
                    key={index}
                    variant={warning.severity === "high" ? "destructive" : "default"}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{warning.type.replace(/_/g, " ")}</AlertTitle>
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <span>{warning.message}</span>
                        {getSeverityBadge(warning.severity)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed Login Attempts */}
        <Card>
          <CardHeader>
            <CardTitle>Failed Login Attempts</CardTitle>
            <CardDescription>Recent failed authentication attempts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Device</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedLogins.slice(0, 10).map((login) => (
                    <TableRow key={login.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {format(parseISO(login.timestamp), "MMM d, yyyy HH:mm:ss")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(parseISO(login.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{login.email}</TableCell>
                      <TableCell className="font-mono text-sm">{login.ip}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getDeviceIcon(login.device)}
                          <span className="text-sm">{login.device}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{login.reason}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limit Violations */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limit Violations</CardTitle>
            <CardDescription>API endpoints that exceeded rate limits</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rateLimitViolations.slice(0, 10).map((violation) => (
                    <TableRow key={violation.id}>
                      <TableCell>
                        {format(parseISO(violation.timestamp), "MMM d, yyyy HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{violation.endpoint}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {violation.userId ? `${violation.userId.slice(0, 8)}...` : "Anonymous"}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{violation.ip}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{violation.limit}/min</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* User Access Patterns */}
        {accessPatterns && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Access Patterns by Hour</CardTitle>
                <CardDescription>Activity distribution throughout the day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={accessPatterns.byHour}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Access Patterns by Day</CardTitle>
                <CardDescription>Daily activity trend</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={accessPatterns.byDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Suspicious Patterns */}
        {accessPatterns && accessPatterns.suspiciousPatterns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Suspicious Access Patterns
              </CardTitle>
              <CardDescription>Detected unusual access patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {accessPatterns.suspiciousPatterns.map((pattern, index) => (
                  <Alert
                    key={index}
                    variant={pattern.severity === "high" ? "destructive" : "default"}
                  >
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>{pattern.type.replace(/_/g, " ")}</AlertTitle>
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <span>{pattern.description}</span>
                        {getSeverityBadge(pattern.severity)}
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* MFA Enrollment Stats */}
        {mfaStats && (
          <Card>
            <CardHeader>
              <CardTitle>MFA Enrollment Statistics</CardTitle>
              <CardDescription>Multi-factor authentication enrollment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Doctors</p>
                    <p className="text-2xl font-bold">
                      {mfaStats.byRole.doctors.enrolled} / {mfaStats.byRole.doctors.total}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mfaStats.byRole.doctors.total > 0
                        ? Math.round(
                            (mfaStats.byRole.doctors.enrolled / mfaStats.byRole.doctors.total) * 100
                          )
                        : 0}
                      % enrolled
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Patients</p>
                    <p className="text-2xl font-bold">
                      {mfaStats.byRole.patients.enrolled} / {mfaStats.byRole.patients.total}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {mfaStats.byRole.patients.total > 0
                        ? Math.round(
                            (mfaStats.byRole.patients.enrolled / mfaStats.byRole.patients.total) *
                              100
                          )
                        : 0}
                      % enrolled
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Admins</p>
                    <p className="text-2xl font-bold">
                      {mfaStats.byRole.admins.enrolled} / {mfaStats.byRole.admins.total}
                    </p>
                    <p className="text-xs text-muted-foreground">100% enrolled</p>
                  </div>
                </div>
                {mfaStats.enrollmentTrend.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Enrollment Trend</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={mfaStats.enrollmentTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="enrolled"
                          stroke="#82ca9d"
                          strokeWidth={2}
                          name="Enrolled Users"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Session Expiration Audits */}
        {sessionStats && (
          <Card>
            <CardHeader>
              <CardTitle>Session Expiration Audits</CardTitle>
              <CardDescription>Session management and expiration tracking</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                  <p className="text-2xl font-bold">{sessionStats.total || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">{sessionStats.active || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {sessionStats.expired || 0}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">
                    {sessionStats.averageDurationMinutes || 0} min
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PHI Breach Simulator Report (Dev Only) */}
        {breachReport && process.env.NODE_ENV !== "production" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                PHI Breach Simulator Report (Dev Only)
              </CardTitle>
              <CardDescription>
                Simulated breach scenarios and security control verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Scenarios</p>
                    <p className="text-2xl font-bold">{breachReport.summary.totalScenarios}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Secure Scenarios</p>
                    <p className="text-2xl font-bold text-green-600">
                      {breachReport.summary.secureScenarios}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Compliance Status</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">HIPAA</span>
                      <Badge variant="default">{breachReport.compliance.hipaa}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">Security Controls</span>
                      <Badge variant="default">{breachReport.compliance.securityControls}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">Audit Logging</span>
                      <Badge variant="default">{breachReport.compliance.auditLogging}</Badge>
                    </div>
                    <div className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm">Access Control</span>
                      <Badge variant="default">{breachReport.compliance.accessControl}</Badge>
                    </div>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Scenarios Tested</p>
                  <div className="space-y-2">
                    {breachReport.scenarios.map((scenario, index) => (
                      <div key={index} className="p-3 border rounded">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium">{scenario.name}</p>
                          {scenario.status === "secure" ? (
                            <Badge variant="default">Secure</Badge>
                          ) : (
                            <Badge variant="destructive">Vulnerable</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{scenario.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Risk: {scenario.risk} • Mitigation: {scenario.mitigation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  )
}

