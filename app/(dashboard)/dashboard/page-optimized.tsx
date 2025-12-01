/**
 * OPTIMIZED Dashboard Page
 * 
 * Optimizations:
 * - Tree-shaken icon imports
 * - Lightweight date utilities
 * - Dynamic route segment
 */

"use client"

import { useEffect, useState, Suspense } from "react"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorDashboardSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/contexts/AuthContext"
// Tree-shaken icon imports
import {
  Calendar as CalendarIcon,
  MessageSquare,
  FileText,
  FlaskConical,
  CreditCard,
  ArrowRight,
  Clock,
  AlertCircle,
  CheckCircle2,
} from "@/lib/icons"
import Link from "next/link"
// Lightweight date utilities
import { formatDate, isToday, parseISO } from "@/lib/utils/date-lite"

// Mark as dynamic route for code splitting
export const dynamic = 'force-dynamic'

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
  status: string
  orderedAt: string
}

interface PaymentAlert {
  id: string
  patientName: string
  amount: number
  dueDate: string
  status: string
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [visitNotes, setVisitNotes] = useState<VisitNote[]>([])
  const [labResults, setLabResults] = useState<LabResult[]>([])
  const [paymentAlerts, setPaymentAlerts] = useState<PaymentAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Fetch all data in parallel for faster loading
        const [appointmentsRes, messagesRes, notesRes, labsRes, paymentsRes] = await Promise.all([
          fetch("/api/appointments?upcoming=true&limit=5", { credentials: "include" }),
          fetch("/api/messages/threads?limit=5", { credentials: "include" }),
          fetch("/api/visit-notes/recent?limit=5", { credentials: "include" }),
          fetch("/api/lab-orders/recent?limit=5", { credentials: "include" }),
          fetch("/api/payments/alerts?limit=5", { credentials: "include" }),
        ])

        if (appointmentsRes.ok) {
          const data = await appointmentsRes.json()
          setAppointments(data || [])
        }

        if (messagesRes.ok) {
          const data = await messagesRes.json()
          setMessages(data || [])
        }

        if (notesRes.ok) {
          const data = await notesRes.json()
          setVisitNotes(data || [])
        }

        if (labsRes.ok) {
          const data = await labsRes.json()
          setLabResults(data || [])
        }

        if (paymentsRes.ok) {
          const data = await paymentsRes.json()
          setPaymentAlerts(data || [])
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [user])

  if (authLoading || loading) {
    return <DoctorDashboardSkeleton />
  }

  const upcomingAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.scheduledAt)
    return aptDate >= new Date() && apt.status !== "CANCELLED"
  }).slice(0, 5)

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user?.firstName || "Doctor"}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{upcomingAppointments.length}</div>
              <p className="text-xs text-muted-foreground">Next 7 days</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unread Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {messages.reduce((sum, m) => sum + (m.unreadCount || 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground">From patients</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Lab Results</CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {labResults.filter((lab) => lab.status === "PENDING").length}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Alerts</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentAlerts.length}</div>
              <p className="text-xs text-muted-foreground">Require attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Appointments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Upcoming Appointments</CardTitle>
                <CardDescription>Your next appointments</CardDescription>
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
            {upcomingAppointments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming appointments</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{appointment.patientName}</h3>
                        <Badge variant={
                          appointment.status === "CONFIRMED" ? "default" :
                          appointment.status === "IN_PROGRESS" ? "secondary" :
                          "outline"
                        }>
                          {appointment.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDate(parseISO(appointment.scheduledAt), "PP p")}
                        </div>
                        <span>{appointment.visitType}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/doctor/appointments/${appointment.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Messages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>Unread messages from patients</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/patient/messages">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No unread messages</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{message.patientName}</h3>
                        {message.unreadCount > 0 && (
                          <Badge variant="default">{message.unreadCount}</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {message.preview || message.subject}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/patient/messages/${message.id}`}>
                        View
                      </Link>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorDashboardLayout>
  )
}

