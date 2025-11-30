"use client"

import { useEffect, useState } from "react"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorAppointmentsSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/contexts/AuthContext"
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
} from "lucide-react"
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, addDays, isToday, isPast } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

type ViewMode = "day" | "week" | "month" | "list"

interface Appointment {
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
    phoneNumber?: string
  }
}

export default function AppointmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>("month")
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchAppointments = async () => {
      if (!user || user.role !== "doctor") return

      try {
        // Calculate date range based on view mode
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
          // Fallback to empty array if API not implemented
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
  }, [user, authLoading, viewMode, selectedDate])

  const handleCancel = async (appointmentId: string) => {
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
        setAppointments((prev) => prev.filter((apt) => apt.id !== appointmentId))
        setSelectedAppointment(null)
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
  }

  const handleReschedule = (appointment: Appointment) => {
    // TODO: Open reschedule dialog
    toast({
      title: "Reschedule Appointment",
      description: "Reschedule functionality coming soon.",
      variant: "default",
    })
  }

  const handleJoinVisit = (appointment: Appointment) => {
    if (appointment.meetingUrl) {
      window.open(appointment.meetingUrl, "_blank")
    } else {
      toast({
        title: "No Meeting Link",
        description: "Meeting link is not available yet.",
        variant: "warning",
      })
    }
  }

  const getStatusBadge = (status: string) => {
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
  }

  const getVisitTypeIcon = (visitType: string) => {
    switch (visitType) {
      case "VIDEO":
        return <Video className="h-4 w-4" />
      case "PHONE":
        return <Phone className="h-4 w-4" />
      case "IN_PERSON":
        return <MapPin className="h-4 w-4" />
      case "CHAT":
        return <MessageSquare className="h-4 w-4" />
      default:
        return <CalendarIcon className="h-4 w-4" />
    }
  }

  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter((apt) => isSameDay(parseISO(apt.scheduledAt), date))
  }

  const getAppointmentsForView = () => {
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
  }

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground mt-2">
              Manage your patient appointments and schedule
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Day
                  </div>
                </SelectItem>
                <SelectItem value="week">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4" />
                    Week
                  </div>
                </SelectItem>
                <SelectItem value="month">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Month
                  </div>
                </SelectItem>
                <SelectItem value="list">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    List
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <Button asChild>
              <Link href="/doctor/appointments/new">New Appointment</Link>
            </Button>
          </div>
        </div>

        {/* Calendar and List Views */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar View (hidden on mobile for list view) */}
          {viewMode !== "list" && (
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>Calendar</CardTitle>
                </CardHeader>
                <CardContent>
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
                </CardContent>
              </Card>
            </div>
          )}

          {/* Appointments List */}
          <div className={viewMode === "list" ? "lg:col-span-3" : "lg:col-span-2"}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
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
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAppointments.length > 0 ? (
                  <div className="space-y-4">
                    {filteredAppointments.map((appointment) => {
                      const aptDate = parseISO(appointment.scheduledAt)
                      const isPastAppointment = isPast(aptDate) && !isToday(aptDate)
                      const canJoin = appointment.status === "CONFIRMED" || appointment.status === "IN_PROGRESS"

                      return (
                        <div
                          key={appointment.id}
                          className="p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                        >
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
                                  onClick={() => handleJoinVisit(appointment)}
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
                                    onClick={() => handleReschedule(appointment)}
                                    className="w-full"
                                  >
                                    Reschedule
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleCancel(appointment.id)}
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
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p className="font-medium mb-1">No appointments</p>
                    <p className="text-sm mb-4">
                      {viewMode === "day"
                        ? "No appointments scheduled for this day"
                        : viewMode === "week"
                        ? "No appointments scheduled for this week"
                        : viewMode === "month"
                        ? "No appointments scheduled for this month"
                        : "No appointments found"}
                    </p>
                    <Button variant="outline" asChild>
                      <Link href="/doctor/appointments/new">Schedule Appointment</Link>
                    </Button>
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

