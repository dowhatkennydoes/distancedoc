"use client"

import { useEffect, useState } from "react"
import { PatientPortalLayout } from "@/components/layouts/PatientPortalLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import {
  Calendar,
  CalendarClock,
  Video,
  Phone,
  MapPin,
  MessageSquare,
  Download,
  Clock,
  FileText,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"
import { format, parseISO, isPast, isToday, isFuture } from "date-fns"
import Link from "next/link"

interface Appointment {
  id: string
  scheduledAt: string
  duration: number
  status: "SCHEDULED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "RESCHEDULED"
  visitType: "VIDEO" | "PHONE" | "IN_PERSON" | "CHAT"
  reason?: string
  meetingUrl?: string
  doctor: {
    id: string
    name: string
    specialization?: string
  }
  visitNote?: {
    id: string
  }
}

export default function PatientAppointmentsPage() {
  const { toast } = useToast()
  const [upcomingAppointments, setUpcomingAppointments] = useState<Appointment[]>([])
  const [pastAppointments, setPastAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAppointments()
  }, [])

  const fetchAppointments = async () => {
    try {
      // Fetch upcoming appointments
      const upcomingResponse = await fetch("/api/appointments/patient?upcoming=true", {
        credentials: "include",
      })

      if (upcomingResponse.ok) {
        const upcomingData = await upcomingResponse.json()
        setUpcomingAppointments(upcomingData || [])
      }

      // Fetch past appointments
      const pastResponse = await fetch("/api/appointments/patient?status=COMPLETED", {
        credentials: "include",
      })

      if (pastResponse.ok) {
        const pastData = await pastResponse.json()
        setPastAppointments(pastData || [])
      } else {
        // Fallback: filter from all appointments
        const allResponse = await fetch("/api/appointments/patient", {
          credentials: "include",
        })
        if (allResponse.ok) {
          const allData = await allResponse.json()
          const now = new Date()
          const past = (allData || []).filter((apt: Appointment) => {
            const aptDate = parseISO(apt.scheduledAt)
            return aptDate < now || apt.status === "COMPLETED"
          })
          setPastAppointments(past)
        }
      }
    } catch (error) {
      console.error("Error fetching appointments:", error)
      toast({
        title: "Error",
        description: "Failed to load appointments",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleJoinVisit = (appointment: Appointment) => {
    if (appointment.meetingUrl) {
      window.open(appointment.meetingUrl, "_blank", "noopener,noreferrer")
    } else {
      toast({
        title: "Meeting Link Not Available",
        description: "The meeting link will be available closer to your appointment time.",
        variant: "default",
      })
    }
  }

  const handleDownloadSummary = async (appointmentId: string) => {
    try {
      // TODO: Implement PDF download
      toast({
        title: "Download Summary",
        description: "Visit summary download functionality coming soon.",
        variant: "default",
      })
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download visit summary. Please try again.",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: Appointment["status"]) => {
    const variants: Record<Appointment["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      SCHEDULED: { variant: "secondary", icon: Clock },
      CONFIRMED: { variant: "default", icon: CheckCircle2 },
      IN_PROGRESS: { variant: "default", icon: Video },
      COMPLETED: { variant: "default", icon: CheckCircle2 },
      CANCELLED: { variant: "destructive", icon: XCircle },
      NO_SHOW: { variant: "outline", icon: AlertCircle },
      RESCHEDULED: { variant: "secondary", icon: CalendarClock },
    }

    const config = variants[status] || variants.SCHEDULED
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    )
  }

  const getVisitTypeIcon = (type: Appointment["visitType"]) => {
    switch (type) {
      case "VIDEO":
        return <Video className="h-4 w-4" />
      case "PHONE":
        return <Phone className="h-4 w-4" />
      case "IN_PERSON":
        return <MapPin className="h-4 w-4" />
      case "CHAT":
        return <MessageSquare className="h-4 w-4" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  const formatAppointmentDate = (dateString: string) => {
    const date = parseISO(dateString)
    if (isToday(date)) {
      return `Today at ${format(date, "h:mm a")}`
    }
    if (isFuture(date) && date.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000) {
      return format(date, "EEEE 'at' h:mm a")
    }
    return format(date, "MMMM d, yyyy 'at' h:mm a")
  }

  if (loading) {
    return (
      <PatientPortalLayout>
        <PageSkeleton />
      </PatientPortalLayout>
    )
  }

  return (
    <PatientPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
            <p className="text-muted-foreground mt-2">Manage your upcoming and past visits</p>
          </div>
          <Button asChild>
            <Link href="/patient/visits/book">
              <Plus className="h-4 w-4 mr-2" />
              Book New Appointment
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming">
              <CalendarClock className="h-4 w-4 mr-2" />
              Upcoming ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              <FileText className="h-4 w-4 mr-2" />
              Past Visits ({pastAppointments.length})
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Appointments */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingAppointments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Upcoming Appointments</h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Schedule your first appointment to get started with telehealth care.
                  </p>
                  <Button asChild>
                    <Link href="/patient/visits/book">
                      <Plus className="h-4 w-4 mr-2" />
                      Book Appointment
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {upcomingAppointments.map((appointment) => {
                  const appointmentDate = parseISO(appointment.scheduledAt)
                  const canJoin = appointment.meetingUrl && (isToday(appointmentDate) || isPast(appointmentDate))
                  const isSoon = appointmentDate.getTime() - Date.now() < 30 * 60 * 1000 // 30 minutes

                  return (
                    <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-xl font-semibold">{appointment.doctor.name}</h3>
                                  {getStatusBadge(appointment.status)}
                                </div>
                                {appointment.doctor.specialization && (
                                  <p className="text-sm text-muted-foreground">
                                    {appointment.doctor.specialization}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4" />
                                <span className="font-medium">{formatAppointmentDate(appointment.scheduledAt)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                <span>{appointment.duration} minutes</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {getVisitTypeIcon(appointment.visitType)}
                                <span>{appointment.visitType.replace("_", " ")}</span>
                              </div>
                            </div>

                            {appointment.reason && (
                              <div className="pt-2 border-t">
                                <p className="text-sm">
                                  <span className="font-medium">Reason:</span> {appointment.reason}
                                </p>
                              </div>
                            )}

                            {isSoon && appointment.status === "CONFIRMED" && (
                              <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3">
                                <p className="text-sm text-blue-900 dark:text-blue-100">
                                  <AlertCircle className="h-4 w-4 inline mr-2" />
                                  Your appointment is starting soon. You can join the visit now.
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-2 lg:min-w-[200px]">
                            {canJoin && (
                              <Button
                                onClick={() => handleJoinVisit(appointment)}
                                className="w-full"
                                size="lg"
                              >
                                <Video className="h-4 w-4 mr-2" />
                                Join Visit
                              </Button>
                            )}
                            {!canJoin && appointment.visitType === "VIDEO" && (
                              <Button variant="outline" disabled className="w-full">
                                <Clock className="h-4 w-4 mr-2" />
                                Join Available Soon
                              </Button>
                            )}
                            <Button variant="outline" asChild className="w-full">
                              <Link href={`/patient/visits/${appointment.id}`}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* Past Visits */}
          <TabsContent value="past" className="space-y-4">
            {pastAppointments.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Past Visits</h3>
                  <p className="text-muted-foreground text-center">
                    Your completed appointments will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pastAppointments.map((appointment) => (
                  <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-semibold">{appointment.doctor.name}</h3>
                                {getStatusBadge(appointment.status)}
                              </div>
                              {appointment.doctor.specialization && (
                                <p className="text-sm text-muted-foreground">
                                  {appointment.doctor.specialization}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <CalendarClock className="h-4 w-4" />
                              <span>{format(parseISO(appointment.scheduledAt), "MMMM d, yyyy 'at' h:mm a")}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {getVisitTypeIcon(appointment.visitType)}
                              <span>{appointment.visitType.replace("_", " ")}</span>
                            </div>
                          </div>

                          {appointment.reason && (
                            <div className="pt-2 border-t">
                              <p className="text-sm">
                                <span className="font-medium">Reason:</span> {appointment.reason}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 lg:min-w-[200px]">
                          {appointment.visitNote && (
                            <Button variant="outline" asChild className="w-full">
                              <Link href={`/patient/summaries/${appointment.visitNote.id}`}>
                                <FileText className="h-4 w-4 mr-2" />
                                View Summary
                              </Link>
                            </Button>
                          )}
                          {appointment.visitNote && (
                            <Button
                              variant="outline"
                              onClick={() => handleDownloadSummary(appointment.id)}
                              className="w-full"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Download Summary
                            </Button>
                          )}
                          <Button variant="ghost" asChild className="w-full">
                            <Link href={`/patient/visits/${appointment.id}`}>
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PatientPortalLayout>
  )
}
