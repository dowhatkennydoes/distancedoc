/**
 * OPTIMIZED Appointments Page
 * 
 * Optimizations:
 * - React.memo for AppointmentCard
 * - useCallback for all handlers
 * - Zustand store for state management
 * - Code splitting for calendar view
 * - Lazy loading of appointment details
 * - Suspense boundaries
 * - Skeleton UI
 */

"use client"

import { Suspense, memo, useCallback, lazy } from "react"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorAppointmentsSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
import { useAppointmentStore } from "@/lib/stores/appointment-store"
import {
  Calendar as CalendarIcon,
  Video,
  Phone,
  MapPin,
  MessageSquare,
  Clock,
  User,
  X,
  CheckCircle2,
} from "lucide-react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, addDays, isToday, isPast } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"
import { useEffect } from "react"

// Lazy load Calendar component (code splitting)
const Calendar = lazy(() => 
  import("@/components/ui/calendar").then(module => ({ default: module.Calendar }))
)

// Memoized AppointmentCard component
const AppointmentCard = memo(({
  appointment,
  onCancel,
  onReschedule,
  onJoinVisit,
}: {
  appointment: {
    id: string
    scheduledAt: string
    duration: number
    status: string
    visitType: string
    reason?: string
    meetingUrl?: string
    patient: {
      id: string
      name: string
      email?: string
    }
  }
  onCancel: (id: string) => void
  onReschedule: (appointment: any) => void
  onJoinVisit: (appointment: any) => void
}) => {
  const aptDate = parseISO(appointment.scheduledAt)
  const isPastAppointment = isPast(aptDate) && !isToday(aptDate)
  const canJoin = appointment.status === "CONFIRMED" || appointment.status === "IN_PROGRESS"

  const getStatusBadge = useCallback((status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      SCHEDULED: { variant: "default", label: "Scheduled" },
      CONFIRMED: { variant: "default", label: "Confirmed" },
      IN_PROGRESS: { variant: "secondary", label: "In Progress" },
      COMPLETED: { variant: "outline", label: "Completed" },
      CANCELLED: { variant: "destructive", label: "Cancelled" },
      NO_SHOW: { variant: "destructive", label: "No Show" },
      RESCHEDULED: { variant: "secondary", label: "Rescheduled" },
    }
    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }, [])

  const getVisitTypeIcon = useCallback((visitType: string) => {
    switch (visitType) {
      case "VIDEO": return <Video className="h-4 w-4" />
      case "PHONE": return <Phone className="h-4 w-4" />
      case "IN_PERSON": return <MapPin className="h-4 w-4" />
      case "CHAT": return <MessageSquare className="h-4 w-4" />
      default: return <CalendarIcon className="h-4 w-4" />
    }
  }, [])

  const handleCancel = useCallback(() => {
    onCancel(appointment.id)
  }, [appointment.id, onCancel])

  const handleReschedule = useCallback(() => {
    onReschedule(appointment)
  }, [appointment, onReschedule])

  const handleJoinVisit = useCallback(() => {
    onJoinVisit(appointment)
  }, [appointment, onJoinVisit])

  return (
    <div className="p-4 rounded-lg border hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              {getVisitTypeIcon(appointment.visitType)}
              <p className="font-semibold">{appointment.patient.name}</p>
            </div>
            {getStatusBadge(appointment.status)}
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {format(aptDate, "MMM d, yyyy 'at' h:mm a")} ({appointment.duration} min)
              </span>
            </div>
            {appointment.patient.email && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{appointment.patient.email}</span>
              </div>
            )}
            {appointment.reason && (
              <p className="mt-2 text-sm">{appointment.reason}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {canJoin && appointment.visitType === "VIDEO" && (
            <Button
              size="sm"
              onClick={handleJoinVisit}
              className="w-full"
            >
              <Video className="mr-2 h-4 w-4" />
              Join Visit
            </Button>
          )}
          {!isPastAppointment && appointment.status !== "CANCELLED" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReschedule}
                className="w-full"
              >
                Reschedule
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleCancel}
                className="w-full"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}
          {appointment.status === "COMPLETED" && (
            <Badge variant="outline" className="w-full justify-center">
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Completed
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
})

AppointmentCard.displayName = 'AppointmentCard'

function AppointmentsPageContent() {
  const { user, loading: authLoading } = useAuth()
  const {
    appointments,
    viewMode,
    selectedDate,
    loading,
    setAppointments,
    setViewMode,
    setSelectedDate,
    setLoading,
    removeAppointment,
  } = useAppointmentStore()
  const { toast } = useToast()

  // Fetch appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user || user.role !== "doctor") return

      try {
        setLoading(true)
        let startDate: Date
        let endDate: Date

        switch (viewMode) {
          case "day":
            startDate = selectedDate
            endDate = addDays(selectedDate, 1)
            break
          case "week":
            startDate = startOfWeek(selectedDate, { weekStartsOn: 1 })
            endDate = endOfWeek(selectedDate, { weekStartsOn: 1 })
            break
          case "month":
            startDate = startOfMonth(selectedDate)
            endDate = endOfMonth(selectedDate)
            break
          default:
            startDate = new Date(2020, 0, 1)
            endDate = new Date(2100, 0, 1)
        }

        const response = await fetch(
          `/api/appointments?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
          { credentials: "include" }
        )

        if (response.ok) {
          const data = await response.json()
          setAppointments(data.appointments || [])
        } else {
          setAppointments([])
        }
      } catch (error) {
        console.error("Error fetching appointments:", error)
        setAppointments([])
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchAppointments()
    }
  }, [user, authLoading, viewMode, selectedDate, setAppointments, setLoading])

  // Memoized handlers
  const handleCancel = useCallback(async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        toast({
          title: "Appointment Cancelled",
          description: "The appointment has been cancelled successfully.",
          variant: "success",
        })
        removeAppointment(appointmentId)
      } else {
        throw new Error("Failed to cancel appointment")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel appointment. Please try again.",
        variant: "destructive",
      })
    }
  }, [toast, removeAppointment])

  const handleReschedule = useCallback((appointment: any) => {
    toast({
      title: "Reschedule Appointment",
      description: "Reschedule functionality coming soon.",
      variant: "default",
    })
  }, [toast])

  const handleJoinVisit = useCallback((appointment: any) => {
    if (appointment.meetingUrl) {
      window.open(appointment.meetingUrl, "_blank")
    } else {
      toast({
        title: "No Meeting Link",
        description: "Meeting link is not available yet.",
        variant: "warning",
      })
    }
  }, [toast])

  const handleViewModeChange = useCallback((mode: "day" | "week" | "month" | "list") => {
    setViewMode(mode)
  }, [setViewMode])

  const handleDateSelect = useCallback((date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
    }
  }, [setSelectedDate])

  // Get filtered appointments
  const getAppointmentsForView = useCallback(() => {
    if (viewMode === "list") {
      return appointments.sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )
    }

    if (viewMode === "day") {
      return appointments.filter((apt) => isSameDay(parseISO(apt.scheduledAt), selectedDate))
    }

    if (viewMode === "week") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
      return appointments.filter((apt) => {
        const aptDate = parseISO(apt.scheduledAt)
        return aptDate >= weekStart && aptDate <= weekEnd
      })
    }

    return appointments
  }, [appointments, viewMode, selectedDate])

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <DoctorAppointmentsSkeleton />
      </DoctorDashboardLayout>
    )
  }

  const filteredAppointments = getAppointmentsForView()

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground mt-2">
              Manage your patient appointments and schedule
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={handleViewModeChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="list">List</SelectItem>
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/doctor/appointments/new">New Appointment</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {viewMode !== "list" && (
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Calendar</CardTitle>
                </CardHeader>
                <CardContent>
                  <Suspense fallback={<div className="h-[300px] animate-pulse bg-muted rounded" />}>
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
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

          <div className={viewMode === "list" ? "lg:col-span-3" : "lg:col-span-2"}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {viewMode === "day" && format(selectedDate, "EEEE, MMMM d, yyyy")}
                  {viewMode === "week" &&
                    `${format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d")} - ${format(endOfWeek(selectedDate, { weekStartsOn: 1 }), "MMM d, yyyy")}`}
                  {viewMode === "month" && format(selectedDate, "MMMM yyyy")}
                  {viewMode === "list" && "All Appointments"}
                </CardTitle>
                <CardDescription>
                  {filteredAppointments.length} appointment{filteredAppointments.length !== 1 ? "s" : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {filteredAppointments.map((appointment) => (
                      <AppointmentCard
                        key={appointment.id}
                        appointment={appointment}
                        onCancel={handleCancel}
                        onReschedule={handleReschedule}
                        onJoinVisit={handleJoinVisit}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-1">No appointments</p>
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

export default function AppointmentsPage() {
  return (
    <Suspense fallback={
      <DoctorDashboardLayout>
        <DoctorAppointmentsSkeleton />
      </DoctorDashboardLayout>
    }>
      <AppointmentsPageContent />
    </Suspense>
  )
}

