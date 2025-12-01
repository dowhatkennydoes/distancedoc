"use client"

import * as React from "react"
import { X, Calendar, Clock, FileText, Shield, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

interface DoctorProfileDrawerProps {
  isOpen: boolean
  onClose: () => void
  doctorId: string | null
}

interface DoctorData {
  id: string
  email: string
  specialization: string | null
  licenseNumber: string
  npiNumber: string | null
  credentials: string[]
  languages: string[]
  timezone: string
  bio: string | null
  approved: boolean
  createdAt: string
  availability: Array<{
    dayOfWeek: string
    startTime: string
    endTime: string
  }>
  appointments: Array<{
    id: string
    scheduledAt: string
    patient: {
      firstName: string
      lastName: string
    }
  }>
  consultations: Array<{
    id: string
    createdAt: string
    patient: {
      firstName: string
      lastName: string
    }
  }>
  visitNotes: Array<{
    id: string
    createdAt: string
  }>
  labOrders: Array<{
    id: string
    createdAt: string
  }>
  files: Array<{
    id: string
    fileName: string
    createdAt: string
  }>
}

const DAYS_OF_WEEK = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]

export function DoctorProfileDrawer({
  isOpen,
  onClose,
  doctorId,
}: DoctorProfileDrawerProps) {
  const [loading, setLoading] = React.useState(false)
  const [doctor, setDoctor] = React.useState<DoctorData | null>(null)

  React.useEffect(() => {
    if (isOpen && doctorId) {
      fetchDoctorDetails()
    } else {
      setDoctor(null)
    }
  }, [isOpen, doctorId])

  const fetchDoctorDetails = async () => {
    if (!doctorId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/doctors/${doctorId}`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setDoctor(data)
      }
    } catch (error) {
      console.error("Failed to fetch doctor details:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-background border-l shadow-lg transition-transform duration-300 ease-in-out overflow-hidden flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 sm:p-6">
          <div>
            <h2 id="drawer-title" className="text-xl font-semibold">
              Doctor Profile
            </h2>
            {doctor?.name && (
              <p className="text-sm text-muted-foreground mt-1">
                {doctor.name}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          ) : doctor ? (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="licensure">Licensure</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="availability">Availability</TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {doctor.name && (
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{doctor.name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{doctor.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Specialization</p>
                      <p className="font-medium">
                        {doctor.specialization || "Not specified"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <Badge
                        variant={doctor.approved ? "default" : "secondary"}
                      >
                        {doctor.approved ? "Approved" : "Pending"}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date Joined</p>
                      <p className="font-medium">
                        {format(new Date(doctor.createdAt), "PPp")}
                      </p>
                    </div>
                    {doctor.bio && (
                      <div>
                        <p className="text-sm text-muted-foreground">Bio</p>
                        <p className="text-sm">{doctor.bio}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Clinic Assignment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Clinic ID</p>
                    <p className="font-medium">{doctor.clinicId || "Not assigned"}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Appointments</p>
                      <p className="text-2xl font-bold">{doctor.appointments.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Consultations</p>
                      <p className="text-2xl font-bold">{doctor.consultations.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Visit Notes</p>
                      <p className="text-2xl font-bold">{doctor.visitNotes.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lab Orders</p>
                      <p className="text-2xl font-bold">{doctor.labOrders.length}</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Licensure Tab */}
              <TabsContent value="licensure" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Licensure Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">License Number</p>
                      <p className="font-medium">{doctor.licenseNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">NPI Number</p>
                      <p className="font-medium">{doctor.npiNumber || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Credentials</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {doctor.credentials.map((cred) => (
                          <Badge key={cred} variant="outline">
                            {cred}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Languages</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {doctor.languages.map((lang) => (
                        <Badge key={lang} variant="secondary">
                          {lang}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Uploaded Documents</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {doctor.files && doctor.files.length > 0 ? (
                      <div className="space-y-2">
                        {doctor.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-2 border rounded"
                          >
                            <span className="text-sm">{file.fileName}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(file.createdAt), "PP")}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No documents uploaded
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Appointments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {doctor.appointments.length > 0 ? (
                      <div className="space-y-3">
                        {doctor.appointments.slice(0, 5).map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">
                                {apt.patient.firstName} {apt.patient.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(apt.scheduledAt), "PPp")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No recent appointments
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Consultations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {doctor.consultations.length > 0 ? (
                      <div className="space-y-3">
                        {doctor.consultations.slice(0, 5).map((consult) => (
                          <div
                            key={consult.id}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">
                                {consult.patient.firstName}{" "}
                                {consult.patient.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(consult.createdAt), "PPp")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No recent consultations
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Availability Tab */}
              <TabsContent value="availability" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Availability Blocks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {doctor.availability && doctor.availability.length > 0 ? (
                      <div className="space-y-3">
                        {DAYS_OF_WEEK.map((day) => {
                          const blocks = doctor.availability.filter(
                            (avail) => avail.dayOfWeek === day
                          )
                          return blocks.length > 0 ? (
                            <div
                              key={day}
                              className="flex items-center justify-between p-3 border rounded"
                            >
                              <span className="font-medium">
                                {day.charAt(0) + day.slice(1).toLowerCase()}
                              </span>
                              <div className="flex gap-2">
                                {blocks.map((block, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {block.startTime} - {block.endTime}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No availability blocks set
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Timezone</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{doctor.timezone}</p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">
                Select a doctor to view profile
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

