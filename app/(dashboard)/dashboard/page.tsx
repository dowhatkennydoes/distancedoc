"use client"

import { useEffect, useState } from "react"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorDashboardSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/AuthContext"
import {
  Calendar,
  MessageSquare,
  FileText,
  FlaskConical,
  CreditCard,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import Link from "next/link"
import { format, isToday, parseISO } from "date-fns"

interface Appointment {
  id: string
  patientName: string
  scheduledAt: string
  visitType: string
  status: string
}

interface Message {
  id: string
  patientName: string
  subject: string
  preview: string
  unreadCount: number
  lastMessageAt: string
}

interface VisitNote {
  id: string
  patientName: string
  chiefComplaint?: string
  createdAt: string
  aiGenerated: boolean
}

interface LabResult {
  id: string
  patientName: string
  testName: string
  orderDate: string
  status: string
}

interface PaymentAlert {
  id: string
  patientName: string
  amount: number
  status: string
  createdAt: string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [dashboardData, setDashboardData] = useState({
    todayAppointments: [] as Appointment[],
    pendingMessages: [] as Message[],
    recentAINotes: [] as VisitNote[],
    unreadLabResults: [] as LabResult[],
    paymentAlerts: [] as PaymentAlert[],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user || user.role !== "doctor") return

      try {
        // Fetch today's appointments
        const appointmentsRes = await fetch("/api/appointments?today=true", {
          credentials: "include",
        })
        const appointments = appointmentsRes.ok ? await appointmentsRes.json() : []

        // Fetch pending messages
        const messagesRes = await fetch("/api/messages/threads?unread=true", {
          credentials: "include",
        })
        const messages = messagesRes.ok ? await messagesRes.json() : []

        // Fetch recent AI notes
        const notesRes = await fetch("/api/visit-notes?recent=true&aiGenerated=true", {
          credentials: "include",
        })
        const notes = notesRes.ok ? await notesRes.json() : []

        // Fetch unread lab results
        const labsRes = await fetch("/api/labs?status=RESULTS_READY&unread=true", {
          credentials: "include",
        })
        const labs = labsRes.ok ? await labsRes.json() : []

        // Fetch payment alerts
        const paymentsRes = await fetch("/api/payments?alerts=true", {
          credentials: "include",
        })
        const payments = paymentsRes.ok ? await paymentsRes.json() : []

        setDashboardData({
          todayAppointments: appointments.slice(0, 5) || [],
          pendingMessages: messages.slice(0, 5) || [],
          recentAINotes: notes.slice(0, 5) || [],
          unreadLabResults: labs.slice(0, 5) || [],
          paymentAlerts: payments.slice(0, 5) || [],
        })
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
        // Set empty data on error
        setDashboardData({
          todayAppointments: [],
          pendingMessages: [],
          recentAINotes: [],
          unreadLabResults: [],
          paymentAlerts: [],
        })
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchDashboardData()
    }
  }, [user, authLoading])

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <DoctorDashboardSkeleton />
      </DoctorDashboardLayout>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      SCHEDULED: { variant: "default", label: "Scheduled" },
      CONFIRMED: { variant: "default", label: "Confirmed" },
      IN_PROGRESS: { variant: "secondary", label: "In Progress" },
      COMPLETED: { variant: "outline", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" },
      RESULTS_READY: { variant: "default", label: "Ready" },
      PENDING: { variant: "secondary", label: "Pending" },
      FAILED: { variant: "destructive", label: "Failed" },
      PROCESSING: { variant: "secondary", label: "Processing" },
    }

    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back, {user?.email}. Here's what needs your attention today.
          </p>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Today's Appointments */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Today's Appointments</CardTitle>
                    <CardDescription>
                      {dashboardData.todayAppointments.length} scheduled for today
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/doctor/appointments">
                    View All
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData.todayAppointments.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.todayAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold">{appointment.patientName}</p>
                          {getStatusBadge(appointment.status)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(parseISO(appointment.scheduledAt), "h:mm a")}
                          </span>
                          <span className="capitalize">{appointment.visitType.toLowerCase()}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/doctor/appointments/${appointment.id}`}>
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-1">No appointments today</p>
                  <p className="text-sm">You're all caught up!</p>
                  <Button variant="outline" size="sm" className="mt-4" asChild>
                    <Link href="/doctor/appointments">Schedule Appointment</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Messages */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Pending Messages</CardTitle>
                    <CardDescription>
                      {dashboardData.pendingMessages.reduce(
                        (sum, msg) => sum + (msg.unreadCount || 0),
                        0
                      )}{" "}
                      unread
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/doctor/messages">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData.pendingMessages.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.pendingMessages.map((message) => (
                    <Link
                      key={message.id}
                      href={`/doctor/messages/${message.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{message.patientName}</p>
                        {message.unreadCount > 0 && (
                          <Badge variant="default" className="text-xs">
                            {message.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium mb-1 truncate">{message.subject}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {message.preview}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(parseISO(message.lastMessageAt), "MMM d, h:mm a")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No pending messages</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent AI Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Recent AI Notes</CardTitle>
                    <CardDescription>AI-generated visit notes</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/doctor/visit-notes">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData.recentAINotes.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.recentAINotes.map((note) => (
                    <Link
                      key={note.id}
                      href={`/doctor/visit-notes/${note.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm">{note.patientName}</p>
                        <Badge variant="secondary" className="text-xs">
                          AI
                        </Badge>
                      </div>
                      {note.chiefComplaint && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {note.chiefComplaint}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(note.createdAt), "MMM d, yyyy")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No recent AI notes</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unread Lab Results */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Unread Lab Results</CardTitle>
                    <CardDescription>
                      {dashboardData.unreadLabResults.length} ready for review
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/doctor/labs">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData.unreadLabResults.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.unreadLabResults.map((lab) => (
                    <Link
                      key={lab.id}
                      href={`/doctor/labs/${lab.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{lab.patientName}</p>
                        <Badge variant="default" className="text-xs">
                          New
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{lab.testName}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(lab.orderDate), "MMM d, yyyy")}
                        </p>
                        {getStatusBadge(lab.status)}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FlaskConical className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No unread lab results</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Alerts */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Payment Alerts</CardTitle>
                    <CardDescription>
                      {dashboardData.paymentAlerts.length} require attention
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/doctor/billing">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {dashboardData.paymentAlerts.length > 0 ? (
                <div className="space-y-3">
                  {dashboardData.paymentAlerts.map((payment) => (
                    <Link
                      key={payment.id}
                      href={`/doctor/billing/${payment.id}`}
                      className="block p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm">{payment.patientName}</p>
                        {payment.status === "FAILED" && (
                          <AlertCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold">
                          ${payment.amount.toFixed(2)}
                        </p>
                        {getStatusBadge(payment.status)}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(payment.createdAt), "MMM d, yyyy")}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">No payment alerts</p>
                  <CheckCircle2 className="h-6 w-6 mx-auto mt-2 text-green-500" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorDashboardLayout>
  )
}
