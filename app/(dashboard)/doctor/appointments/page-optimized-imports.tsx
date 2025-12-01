/**
 * OPTIMIZED Appointments Page with Lazy Loading
 * 
 * Optimizations:
 * - Lazy-loaded Calendar component
 * - Tree-shaken icon imports
 * - Lightweight date utilities
 * - Dynamic route segment
 */

"use client"

import { useEffect, useState, Suspense } from "react"
import dynamic from "next/dynamic"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorAppointmentsSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
// Tree-shaken icon imports
import {
  Calendar as CalendarIcon,
  List,
  Video,
  Phone,
  MapPin,
  MessageSquare,
  Clock,
  User,
  X,
  CalendarClock,
  CheckCircle2,
  AlertCircle,
} from "@/lib/icons" // Use centralized icon exports
// Lightweight date utilities (tree-shakeable)
import {
  formatDate,
  parseISO,
  isSameDay,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isToday,
  isPast,
} from "@/lib/utils/date-lite"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

// Lazy load Calendar component
const Calendar = dynamic(
  () => import("@/components/ui/calendar-lazy").then((mod) => ({ default: mod.Calendar })),
  {
    loading: () => (
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-7 w-7" />
            <Skeleton className="h-7 w-7" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-9" />
          ))}
        </div>
      </div>
    ),
    ssr: false,
  }
)

type ViewMode = "day" | "week" | "month" | "list"

interface Appointment {
  id: string
  scheduledAt: string
  duration: number
  patientName: string
  visitType: string
  status: string
  reason?: string
}

// Mark this route as dynamic to enable route-based code splitting
export const dynamic = 'force-dynamic'

export default function AppointmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Rest of the component remains the same...
  // Just with optimized imports

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user) return

      try {
        setLoading(true)
        const response = await fetch("/api/appointments", {
          credentials: "include",
        })

        if (!response.ok) {
          throw new Error("Failed to fetch appointments")
        }

        const data = await response.json()
        setAppointments(data || [])
      } catch (error) {
        console.error("Error fetching appointments:", error)
        toast({
          title: "Error",
          description: "Failed to load appointments.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAppointments()
  }, [user, toast])

  // Filter appointments based on selected date and view mode
  const filteredAppointments = appointments.filter((apt) => {
    const aptDate = parseISO(apt.scheduledAt)

    if (statusFilter !== "all" && apt.status !== statusFilter) {
      return false
    }

    switch (viewMode) {
      case "day":
        return isSameDay(aptDate, selectedDate)
      case "week":
        const weekStart = startOfWeek(selectedDate)
        const weekEnd = endOfWeek(selectedDate)
        return aptDate >= weekStart && aptDate <= weekEnd
      case "month":
        const monthStart = startOfMonth(selectedDate)
        const monthEnd = endOfMonth(selectedDate)
        return aptDate >= monthStart && aptDate <= monthEnd
      default:
        return true
    }
  })

  if (authLoading || loading) {
    return <DoctorAppointmentsSkeleton />
  }

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Appointments</h1>
            <p className="text-muted-foreground mt-1">
              Manage your appointments and schedule
            </p>
          </div>
          <Button asChild>
            <Link href="/doctor/appointments/new">
              <CalendarIcon className="h-4 w-4 mr-2" />
              New Appointment
            </Link>
          </Button>
        </div>

        {/* Filters and View Mode */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("month")}
            >
              Month
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("week")}
            >
              Week
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("day")}
            >
              Day
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4 mr-2" />
              List
            </Button>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Calendar and List Views */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar View - Lazy Loaded */}
          {viewMode !== "list" && (
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Calendar</CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={
                    <div className="p-3 space-y-4">
                      <Skeleton className="h-6 w-24" />
                      <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 35 }).map((_, i) => (
                          <Skeleton key={i} className="h-9 w-9" />
                        ))}
                      </div>
                    </div>
                  }>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      modifiers={{
                        hasAppointment: appointments.map((apt) => parseISO(apt.scheduledAt)),
                      }}
                      modifiersClassNames={{
                        hasAppointment: "bg-primary/10 text-primary font-semibold",
                      }}
                    />
                  </Suspense>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Appointments List */}
          <div className={viewMode === "list" ? "lg:col-span-3" : "lg:col-span-2"}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {viewMode === "day" && formatDate(selectedDate, "PP")}
                  {viewMode === "week" && `Week of ${formatDate(startOfWeek(selectedDate), "PP")}`}
                  {viewMode === "month" && formatDate(selectedDate, "MM yyyy")}
                  {viewMode === "list" && "All Appointments"}
                </CardTitle>
                <CardDescription>
                  {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarClock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No appointments found for the selected period.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredAppointments.map((appointment) => (
                      <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <h3 className="font-semibold">{appointment.patientName}</h3>
                                <Badge variant={
                                  appointment.status === "COMPLETED" ? "default" :
                                  appointment.status === "CANCELLED" ? "destructive" :
                                  appointment.status === "IN_PROGRESS" ? "secondary" :
                                  "outline"
                                }>
                                  {appointment.status}
                                </Badge>
                              </div>
                              <div className="space-y-1 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4" />
                                  {formatDate(parseISO(appointment.scheduledAt), "PP p")}
                                  <span className="mx-1">•</span>
                                  {appointment.duration} min
                                </div>
                                <div className="flex items-center gap-2">
                                  {appointment.visitType === "VIDEO" ? (
                                    <Video className="h-4 w-4" />
                                  ) : appointment.visitType === "PHONE" ? (
                                    <Phone className="h-4 w-4" />
                                  ) : (
                                    <MapPin className="h-4 w-4" />
                                  )}
                                  {appointment.visitType.replace("_", " ")}
                                </div>
                                {appointment.reason && (
                                  <p className="mt-2">{appointment.reason}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/doctor/appointments/${appointment.id}`}>
                                  View
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DoctorDashboardLayout>
  )
}

