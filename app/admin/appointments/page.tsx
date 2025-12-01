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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  MoreVertical,
  Calendar,
  CalendarClock,
  List,
  Video,
  Phone,
  MapPin,
  MessageSquare,
  User,
  Clock,
  RefreshCw,
  Eye,
  CalendarIcon,
  UserCheck,
  X,
  ArrowLeftRight,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { format, isSameDay, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, startOfDay, endOfDay } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

type ViewMode = "day" | "week" | "month" | "table"

interface Appointment {
  id: string
  scheduledAt: string
  duration: number
  status: string
  visitType: string
  reason: string | null
  notes: string | null
  meetingUrl: string | null
  doctor: {
    id: string
    name: string
    specialization: string | null
  }
  patient: {
    id: string
    name: string
    firstName: string
    lastName: string
    phone: string | null
    email: string | null
  }
  consultation: {
    id: string
    status: string
    startedAt: string | null
    endedAt: string | null
  } | null
  visitNote: {
    id: string
    createdAt: string
  } | null
  createdAt: string
  cancelledAt: string | null
  completedAt: string | null
}

export default function AdminAppointmentsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [appointments, setAppointments] = React.useState<Appointment[]>([])
  const [viewMode, setViewMode] = React.useState<ViewMode>("table")
  const [selectedDate, setSelectedDate] = React.useState<Date>(new Date())
  const [doctorFilter, setDoctorFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [doctors, setDoctors] = React.useState<
    Array<{ id: string; name: string; specialization: string }>
  >([])
  const [actionDialog, setActionDialog] = React.useState<{
    open: boolean
    action: string | null
    appointment: Appointment | null
    scheduledAt?: string
    doctorId?: string
  }>({
    open: false,
    action: null,
    appointment: null,
  })
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })

  // Real-time status indicator refresh
  const [statusRefresh, setStatusRefresh] = React.useState(0)

  // Auto-refresh appointments every 30 seconds for real-time updates
  React.useEffect(() => {
    if (viewMode === "table") return // Only refresh for calendar views

    const interval = setInterval(() => {
      setStatusRefresh((prev) => prev + 1)
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [viewMode])

  const fetchAppointments = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        viewMode: viewMode === "table" ? "all" : viewMode,
        selectedDate: selectedDate.toISOString(),
      })

      if (doctorFilter !== "all") {
        params.append("doctorId", doctorFilter)
      }
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/admin/appointments?${params.toString()}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setAppointments(data.appointments || [])
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }))
      }
    } catch (error) {
      console.error("Failed to fetch appointments:", error)
      toast({
        title: "Error",
        description: "Failed to fetch appointments. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, viewMode, selectedDate, doctorFilter, statusFilter, pagination.page, pagination.limit, toast, statusRefresh])

  const fetchDoctors = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    try {
      const response = await fetch("/api/admin/doctors?limit=100", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setDoctors(
          (data.doctors || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            specialization: d.specialization,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error)
    }
  }, [user])

  React.useEffect(() => {
    fetchAppointments()
    fetchDoctors()
  }, [fetchAppointments, fetchDoctors])

  const handleAction = async (
    action: string,
    appointment: Appointment,
    additionalData?: { scheduledAt?: string; doctorId?: string }
  ) => {
    try {
      const response = await fetch(
        `/api/admin/appointments/${appointment.id}/actions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            action,
            appointmentId: appointment.id,
            ...additionalData,
          }),
        }
      )

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: data.message || `Appointment ${action}d successfully`,
        })
        fetchAppointments() // Refresh list
        setActionDialog({ open: false, action: null, appointment: null })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to perform action")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to perform action",
        variant: "destructive",
      })
    }
  }

  const openActionDialog = (action: string, appointment: Appointment) => {
    if (action === "reschedule" || action === "reassign") {
      setActionDialog({
        open: true,
        action,
        appointment,
        scheduledAt:
          action === "reschedule"
            ? new Date(appointment.scheduledAt).toISOString().slice(0, 16)
            : undefined,
        doctorId: action === "reassign" ? appointment.doctor.id : undefined,
      })
    } else {
      handleAction(action, appointment)
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      {
        variant: "default" | "secondary" | "destructive" | "outline"
        label: string
        icon?: React.ReactNode
      }
    > = {
      SCHEDULED: {
        variant: "default",
        label: "Scheduled",
        icon: <Clock className="h-3 w-3 mr-1" />,
      },
      CONFIRMED: {
        variant: "default",
        label: "Confirmed",
        icon: <Calendar className="h-3 w-3 mr-1" />,
      },
      IN_PROGRESS: {
        variant: "secondary",
        label: "In Progress",
        icon: <Clock className="h-3 w-3 mr-1" />,
      },
      COMPLETED: {
        variant: "outline",
        label: "Completed",
        icon: <Clock className="h-3 w-3 mr-1" />,
      },
      CANCELLED: {
        variant: "destructive",
        label: "Cancelled",
        icon: <X className="h-3 w-3 mr-1" />,
      },
      NO_SHOW: {
        variant: "destructive",
        label: "No Show",
        icon: <X className="h-3 w-3 mr-1" />,
      },
      RESCHEDULED: {
        variant: "secondary",
        label: "Rescheduled",
        icon: <CalendarClock className="h-3 w-3 mr-1" />,
      },
    }

    const statusInfo = statusMap[status] || {
      variant: "outline" as const,
      label: status,
    }
    return (
      <Badge variant={statusInfo.variant} className="flex items-center w-fit">
        {statusInfo.icon}
        {statusInfo.label}
      </Badge>
    )
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
    return appointments.filter((apt) =>
      isSameDay(parseISO(apt.scheduledAt), date)
    )
  }

  const getAppointmentsForView = () => {
    if (viewMode === "table") {
      return appointments
    }

    if (viewMode === "day") {
      return appointments.filter((apt) =>
        isSameDay(parseISO(apt.scheduledAt), selectedDate)
      )
    }

    if (viewMode === "week") {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })
      return appointments.filter((apt) => {
        const aptDate = parseISO(apt.scheduledAt)
        return aptDate >= weekStart && aptDate <= weekEnd
      })
    }

    if (viewMode === "month") {
      const monthStart = startOfMonth(selectedDate)
      const monthEnd = endOfMonth(selectedDate)
      return appointments.filter((apt) => {
        const aptDate = parseISO(apt.scheduledAt)
        return aptDate >= monthStart && aptDate <= monthEnd
      })
    }

    return appointments
  }

  const viewAppointments = getAppointmentsForView()

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground mt-1">
              Manage all clinic appointments and schedules
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={viewMode}
              onValueChange={(value) => setViewMode(value as ViewMode)}
            >
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
                <SelectItem value="table">
                  <div className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Table
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter appointments by doctor, status, or date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Doctors</SelectItem>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.specialization})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="canceled">Cancelled</SelectItem>
                  <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setDoctorFilter("all")
                  setStatusFilter("all")
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Calendar and Table Views */}
        {viewMode === "table" ? (
          // Table View
          <Card>
            <CardHeader>
              <CardTitle>All Appointments ({pagination.total})</CardTitle>
              <CardDescription>
                Showing {appointments.length} of {pagination.total} appointments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-muted-foreground">Loading appointments...</div>
                </div>
              ) : appointments.length === 0 ? (
                <div className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <p className="text-muted-foreground">No appointments found</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try adjusting your filters
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date & Time</TableHead>
                          <TableHead>Patient</TableHead>
                          <TableHead>Doctor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Duration</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {appointments.map((apt) => (
                          <TableRow key={apt.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {format(parseISO(apt.scheduledAt), "MMM d, yyyy")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(parseISO(apt.scheduledAt), "h:mm a")}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <p className="font-medium">{apt.patient.name}</p>
                                  {apt.patient.phone && (
                                    <p className="text-xs text-muted-foreground">
                                      {apt.patient.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{apt.doctor.name}</p>
                              {apt.doctor.specialization && (
                                <p className="text-xs text-muted-foreground">
                                  {apt.doctor.specialization}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getVisitTypeIcon(apt.visitType)}
                                <span className="text-sm capitalize">
                                  {apt.visitType.toLowerCase().replace("_", " ")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(apt.status)}
                              {/* Real-time status indicator */}
                              {apt.status === "IN_PROGRESS" && (
                                <div className="flex items-center gap-1 mt-1">
                                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                  <span className="text-xs text-muted-foreground">
                                    Live
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>{apt.duration} min</TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {apt.consultation && (
                                    <DropdownMenuItem>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Consultation Details
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("reschedule", apt)}
                                  >
                                    <CalendarClock className="h-4 w-4 mr-2" />
                                    Reschedule
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("reassign", apt)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Reassign Doctor
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("cancel", apt)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel Appointment
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Page {pagination.page} of {pagination.totalPages}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPagination((prev) => ({
                              ...prev,
                              page: Math.max(1, prev.page - 1),
                            }))
                          }
                          disabled={pagination.page === 1}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPagination((prev) => ({
                              ...prev,
                              page: Math.min(prev.totalPages, prev.page + 1),
                            }))
                          }
                          disabled={pagination.page === pagination.totalPages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          // Calendar View (day/week/month)
          <div className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Calendar */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Calendar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      modifiers={{
                        hasAppointment: appointments.map((apt) =>
                          parseISO(apt.scheduledAt)
                        ),
                      }}
                      modifiersClassNames={{
                        hasAppointment: "bg-primary/10 text-primary font-semibold",
                      }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Appointments List */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {viewMode === "day"
                        ? format(selectedDate, "EEEE, MMMM d, yyyy")
                        : viewMode === "week"
                        ? `Week of ${format(selectedDate, "MMMM d, yyyy")}`
                        : format(selectedDate, "MMMM yyyy")}
                    </CardTitle>
                    <CardDescription>
                      {viewAppointments.length} appointment(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="text-muted-foreground">Loading...</div>
                      </div>
                    ) : viewAppointments.length === 0 ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="text-center">
                          <p className="text-muted-foreground">No appointments found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Try adjusting your filters or date range
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {viewAppointments.map((apt) => (
                          <Card key={apt.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {getVisitTypeIcon(apt.visitType)}
                                  <span className="font-medium">
                                    {format(parseISO(apt.scheduledAt), "h:mm a")}
                                  </span>
                                  {getStatusBadge(apt.status)}
                                  {/* Real-time status indicator */}
                                  {apt.status === "IN_PROGRESS" && (
                                    <div className="flex items-center gap-1 ml-2">
                                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                      <span className="text-xs text-muted-foreground">Live</span>
                                    </div>
                                  )}
                                </div>
                                <p className="font-semibold">{apt.patient.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {apt.doctor.name} • {apt.duration} min
                                </p>
                                {apt.reason && (
                                  <p className="text-sm mt-1">{apt.reason}</p>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("reschedule", apt)}
                                  >
                                    <CalendarClock className="h-4 w-4 mr-2" />
                                    Reschedule
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("reassign", apt)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Reassign Doctor
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("cancel", apt)}
                                    className="text-destructive"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                  </DropdownMenuItem>
                                  {apt.consultation && (
                                    <>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem>
                                        <Eye className="h-4 w-4 mr-2" />
                                        View Consultation
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Calendar */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Calendar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      modifiers={{
                        hasAppointment: appointments.map((apt) =>
                          parseISO(apt.scheduledAt)
                        ),
                      }}
                      modifiersClassNames={{
                        hasAppointment: "bg-primary/10 text-primary font-semibold",
                      }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Appointments List */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      {viewMode === "day"
                        ? format(selectedDate, "EEEE, MMMM d, yyyy")
                        : viewMode === "week"
                        ? `Week of ${format(selectedDate, "MMMM d, yyyy")}`
                        : format(selectedDate, "MMMM yyyy")}
                    </CardTitle>
                    <CardDescription>
                      {viewAppointments.length} appointment(s)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="text-muted-foreground">Loading...</div>
                      </div>
                    ) : viewAppointments.length === 0 ? (
                      <div className="flex items-center justify-center h-[400px]">
                        <div className="text-center">
                          <p className="text-muted-foreground">No appointments found</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Try adjusting your filters or date range
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {viewAppointments.map((apt) => (
                          <Card key={apt.id} className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {getVisitTypeIcon(apt.visitType)}
                                  <span className="font-medium">
                                    {format(parseISO(apt.scheduledAt), "h:mm a")}
                                  </span>
                                  {getStatusBadge(apt.status)}
                                  {/* Real-time status indicator */}
                                  {apt.status === "IN_PROGRESS" && (
                                    <div className="flex items-center gap-1 ml-2">
                                      <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                                      <span className="text-xs text-muted-foreground">Live</span>
                                    </div>
                                  )}
                                </div>
                                <p className="font-semibold">{apt.patient.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {apt.doctor.name} • {apt.duration} min
                                </p>
                                {apt.reason && (
                                  <p className="text-sm mt-1">{apt.reason}</p>
                                )}
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {apt.consultation && (
                                    <DropdownMenuItem>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Consultation
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("reschedule", apt)}
                                  >
                                    <CalendarClock className="h-4 w-4 mr-2" />
                                    Reschedule
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("reassign", apt)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Reassign Doctor
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openActionDialog("cancel", apt)}
                                    className="text-destructive"
                                  >
                                    <X className="h-4 w-4 mr-2" />
                                    Cancel
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reschedule Dialog */}
      <Dialog
        open={actionDialog.open && actionDialog.action === "reschedule"}
        onOpenChange={(open) =>
          setActionDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Reschedule appointment for {actionDialog.appointment?.patient.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rescheduleDate">New Date & Time</Label>
              <Input
                id="rescheduleDate"
                type="datetime-local"
                value={actionDialog.scheduledAt || ""}
                onChange={(e) =>
                  setActionDialog((prev) => ({
                    ...prev,
                    scheduledAt: e.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog({ open: false, action: null, appointment: null })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.appointment && actionDialog.scheduledAt) {
                  handleAction("reschedule", actionDialog.appointment, {
                    scheduledAt: actionDialog.scheduledAt,
                  })
                }
              }}
              disabled={!actionDialog.scheduledAt}
            >
              Reschedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reassign Dialog */}
      <Dialog
        open={actionDialog.open && actionDialog.action === "reassign"}
        onOpenChange={(open) =>
          setActionDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Appointment</DialogTitle>
            <DialogDescription>
              Reassign appointment to a different doctor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doctor">Select Doctor</Label>
              <Select
                value={actionDialog.doctorId || ""}
                onValueChange={(value) =>
                  setActionDialog((prev) => ({ ...prev, doctorId: value }))
                }
              >
                <SelectTrigger id="doctor" className="mt-2">
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.specialization})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog({ open: false, action: null, appointment: null })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.appointment && actionDialog.doctorId) {
                  handleAction("reassign", actionDialog.appointment, {
                    doctorId: actionDialog.doctorId,
                  })
                }
              }}
              disabled={!actionDialog.doctorId}
            >
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

