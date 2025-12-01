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
import {
  Users,
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  Activity,
  TrendingUp,
  UserPlus,
  LogIn,
  Stethoscope,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { formatDistanceToNow, parseISO } from "date-fns"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    label: string
    isPositive: boolean
  }
}

function MetricCard({ title, value, description, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <TrendingUp
              className={`h-3 w-3 ${
                trend.isPositive ? "text-green-500" : "text-red-500"
              }`}
            />
            <span
              className={`text-xs ${
                trend.isPositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {trend.value > 0 ? "+" : ""}
              {trend.value}% {trend.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
}

function ChartCard({ title, description, children }: ChartCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

// Recharts line chart component
function AppointmentsLineChart({
  data,
}: {
  data: Array<{ date: string; value: number }>
}) {
  // Format data for Recharts
  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    appointments: d.value,
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis
          dataKey="date"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: "12px" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Line
          type="monotone"
          dataKey="appointments"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--primary))", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

// Recharts bar chart component
function PatientRegistrationsBarChart({
  data,
}: {
  data: Array<{ label: string; value: number }>
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" />
        <XAxis
          dataKey="label"
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: "12px" }}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          style={{ fontSize: "12px" }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Bar
          dataKey="value"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function AdminDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = React.useState(true)
  const [metrics, setMetrics] = React.useState({
    activeDoctors: 0,
    activePatients: 0,
    todayAppointments: 0,
    monthlyRevenue: 0,
    pendingApprovals: 0,
    systemUptime: "99.9%",
    trends: {
      doctors: { value: 0, label: "from last month", isPositive: true },
      patients: { value: 0, label: "from last month", isPositive: true },
      revenue: { value: 0, label: "from last month", isPositive: true },
    },
  })
  const [appointmentsOverTime, setAppointmentsOverTime] = React.useState<
    Array<{ date: string; value: number }>
  >([])
  const [newPatientRegistrations, setNewPatientRegistrations] = React.useState<
    Array<{ label: string; value: number }>
  >([])

  const [recentLogins, setRecentLogins] = React.useState<
    Array<{
      id: string
      user: string
      role: string
      ip: string
      location: string
      timestamp: Date
      status: string
    }>
  >([])
  const [doctorActivityFeed, setDoctorActivityFeed] = React.useState<
    Array<{
      id: string
      doctor: string
      action: string
      patient: string
      timestamp: Date
    }>
  >([])
  const [systemEvents, setSystemEvents] = React.useState<
    Array<{
      id: string
      type: string
      message: string
      timestamp: Date
    }>
  >([])

  React.useEffect(() => {
    const fetchAllData = async () => {
      if (!user || user.role !== "admin") return

      try {
        // Fetch metrics
        const metricsRes = await fetch("/api/admin/metrics", {
          credentials: "include",
        })
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json()
          setMetrics({
            activeDoctors: metricsData.activeDoctors || 0,
            activePatients: metricsData.activePatients || 0,
            todayAppointments: metricsData.todayAppointments || 0,
            monthlyRevenue: metricsData.monthlyRevenue || 0,
            pendingApprovals: metricsData.pendingApprovals || 0,
            systemUptime: metricsData.systemUptime || "99.9%",
            trends: metricsData.trends || {
              doctors: { value: 0, label: "from last month", isPositive: true },
              patients: { value: 0, label: "from last month", isPositive: true },
              revenue: { value: 0, label: "from last month", isPositive: true },
            },
          })
        }

        // Fetch appointments over time
        const appointmentsRes = await fetch(
          "/api/admin/appointments-over-time?days=30",
          { credentials: "include" }
        )
        if (appointmentsRes.ok) {
          const appointmentsData = await appointmentsRes.json()
          setAppointmentsOverTime(appointmentsData || [])
        }

        // Fetch patient registrations
        const registrationsRes = await fetch(
          "/api/admin/patient-registrations?months=6",
          { credentials: "include" }
        )
        if (registrationsRes.ok) {
          const registrationsData = await registrationsRes.json()
          setNewPatientRegistrations(registrationsData || [])
        }

        // Fetch recent logins
        const loginsRes = await fetch("/api/admin/recent-logins?limit=5", {
          credentials: "include",
        })
        if (loginsRes.ok) {
          const loginsData = await loginsRes.json()
          setRecentLogins(
            loginsData.map((login: any) => ({
              ...login,
              timestamp: new Date(login.timestamp),
            }))
          )
        }

        // Fetch doctor activity
        const activityRes = await fetch("/api/admin/doctor-activity?limit=5", {
          credentials: "include",
        })
        if (activityRes.ok) {
          const activityData = await activityRes.json()
          setDoctorActivityFeed(
            activityData.map((activity: any) => ({
              ...activity,
              timestamp: new Date(activity.timestamp),
            }))
          )
        }

        // Fetch system events
        const eventsRes = await fetch("/api/admin/system-events?limit=5", {
          credentials: "include",
        })
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          setSystemEvents(
            eventsData.map((event: any) => ({
              ...event,
              timestamp: new Date(event.timestamp),
            }))
          )
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchAllData()
  }, [user])

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-muted-foreground">Loading dashboard...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your clinic operations and system health
          </p>
        </div>

        {/* Key Clinic Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Active Doctors"
            value={metrics.activeDoctors}
            description="Currently active providers"
            icon={Users}
            trend={metrics.trends.doctors}
          />
          <MetricCard
            title="Active Patients"
            value={metrics.activePatients}
            description="Total registered patients"
            icon={Users}
            trend={metrics.trends.patients}
          />
          <MetricCard
            title="Today's Appointments"
            value={metrics.todayAppointments}
            description="Scheduled for today"
            icon={Calendar}
          />
          <MetricCard
            title="Monthly Revenue"
            value={`$${metrics.monthlyRevenue.toLocaleString()}`}
            description="Current month (Stripe)"
            icon={DollarSign}
            trend={metrics.trends.revenue}
          />
          <MetricCard
            title="Pending Approvals"
            value={metrics.pendingApprovals}
            description="Doctors awaiting approval"
            icon={AlertCircle}
          />
          <MetricCard
            title="System Uptime"
            value={metrics.systemUptime}
            description="Last 30 days"
            icon={Activity}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <ChartCard
            title="Appointments Over Time"
            description="Daily appointment volume (last 30 days)"
          >
            <AppointmentsLineChart data={appointmentsOverTime} />
          </ChartCard>

          <ChartCard
            title="New Patient Registrations"
            description="Monthly new patient signups"
          >
            <PatientRegistrationsBarChart data={newPatientRegistrations} />
          </ChartCard>
        </div>

        {/* Tables */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Recent Logins */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Recent Logins
              </CardTitle>
              <CardDescription>Last 5 login attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogins.map((login) => (
                    <TableRow key={login.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{login.user}</span>
                          <span className="text-xs text-muted-foreground">
                            {login.role}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {login.status === "success" ? (
                          <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Success
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <XCircle className="h-3 w-3 mr-1" />
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(login.timestamp, { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Doctor Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5" />
                Doctor Activity
              </CardTitle>
              <CardDescription>Recent doctor actions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctorActivityFeed.map((activity) => (
                    <TableRow key={activity.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{activity.doctor}</span>
                          <span className="text-xs text-muted-foreground">
                            {activity.patient}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">{activity.action}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(activity.timestamp, {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* System Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                System Events
              </CardTitle>
              <CardDescription>Recent system activity</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {systemEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {event.type === "success" && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {event.type === "error" && (
                            <XCircle className="h-4 w-4 text-red-500" />
                          )}
                          {event.type === "warning" && (
                            <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          )}
                          {event.type === "info" && (
                            <Activity className="h-4 w-4 text-blue-500" />
                          )}
                          <span className="text-sm">{event.message}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

