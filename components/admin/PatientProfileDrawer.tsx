"use client"

import * as React from "react"
import { X, AlertTriangle, Calendar, FileText, MessageSquare, FlaskConical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { format } from "date-fns"

interface PatientProfileDrawerProps {
  isOpen: boolean
  onClose: () => void
  patientId: string | null
}

interface PatientData {
  id: string
  firstName: string
  lastName: string
  email: string | null
  dateOfBirth: string
  phone: string | null
  sex: string
  genderIdentity: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  emergencyContact: string | null
  preferredPharmacy: string | null
  preferredLanguage: string | null
  insuranceProvider: string | null
  insuranceMemberId: string | null
  allergies: any
  currentMedicationsData: any
  pastMedicalHistory: any
  familyHistory: any
  clinicId: string
  createdAt: string
  appointmentCount: number
  messageCount: number
  assignedDoctor: {
    id: string
    specialization: string | null
  } | null
  appointments: Array<{
    id: string
    scheduledAt: string
    doctor: {
      specialization: string | null
    }
  }>
  consultations: Array<{
    id: string
    createdAt: string
    doctor: {
      specialization: string | null
    }
  }>
  visitNotes: Array<{
    id: string
    createdAt: string
    followUpDate: string | null
  }>
  intakeForms: Array<{
    id: string
    type: string
    status: string
    createdAt: string
  }>
  labOrders: Array<{
    id: string
    testName: string | null
    status: string
    createdAt: string
  }>
  medications: Array<{
    id: string
    name: string
    status: string
  }>
}

export function PatientProfileDrawer({
  isOpen,
  onClose,
  patientId,
}: PatientProfileDrawerProps) {
  const [loading, setLoading] = React.useState(false)
  const [patient, setPatient] = React.useState<PatientData | null>(null)

  React.useEffect(() => {
    if (isOpen && patientId) {
      fetchPatientDetails()
    } else {
      setPatient(null)
    }
  }, [isOpen, patientId])

  const fetchPatientDetails = async () => {
    if (!patientId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/patients/${patientId}`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setPatient(data)
      }
    } catch (error) {
      console.error("Failed to fetch patient details:", error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAge = (dateOfBirth: string) => {
    const birthDate = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
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
              Patient Profile
            </h2>
            {patient && (
              <p className="text-sm text-muted-foreground mt-1">
                {patient.firstName} {patient.lastName}
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
          ) : patient ? (
            <Tabs defaultValue="demographics" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="demographics">Demographics</TabsTrigger>
                <TabsTrigger value="insurance">Insurance</TabsTrigger>
                <TabsTrigger value="flags">Flags & Risks</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              {/* Demographics Tab */}
              <TabsContent value="demographics" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">First Name</p>
                        <p className="font-medium">{patient.firstName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Last Name</p>
                        <p className="font-medium">{patient.lastName}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Date of Birth</p>
                      <p className="font-medium">
                        {format(new Date(patient.dateOfBirth), "PPP")} ({calculateAge(patient.dateOfBirth)} years old)
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Sex</p>
                        <p className="font-medium">{patient.sex}</p>
                      </div>
                      {patient.genderIdentity && (
                        <div>
                          <p className="text-sm text-muted-foreground">Gender Identity</p>
                          <p className="font-medium">{patient.genderIdentity}</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{patient.email || "Not provided"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="font-medium">{patient.phone || "Not provided"}</p>
                    </div>
                  </CardContent>
                </Card>

                {(patient.addressLine1 ||
                  patient.city ||
                  patient.state ||
                  patient.postalCode) && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Address</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">
                        {patient.addressLine1}
                        {patient.addressLine2 && `, ${patient.addressLine2}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {patient.city}, {patient.state} {patient.postalCode}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Appointments</p>
                      <p className="text-2xl font-bold">{patient.appointmentCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Messages</p>
                      <p className="text-2xl font-bold">{patient.messageCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Intake Forms</p>
                      <p className="text-2xl font-bold">{patient.intakeForms.length}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Lab Orders</p>
                      <p className="text-2xl font-bold">{patient.labOrders.length}</p>
                    </div>
                  </CardContent>
                </Card>

                {patient.assignedDoctor && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Assigned Doctor</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">
                        {patient.assignedDoctor.specialization || "Doctor"}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Insurance Tab */}
              <TabsContent value="insurance" className="space-y-4 mt-4">
                {patient.insuranceProvider ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Insurance Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Provider</p>
                        <p className="font-medium">{patient.insuranceProvider}</p>
                      </div>
                      {patient.insuranceMemberId && (
                        <div>
                          <p className="text-sm text-muted-foreground">Member ID</p>
                          <p className="font-medium">{patient.insuranceMemberId}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="pt-6">
                      <p className="text-sm text-muted-foreground text-center">
                        No insurance information on file
                      </p>
                    </CardContent>
                  </Card>
                )}

                {patient.preferredPharmacy && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Preferred Pharmacy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{patient.preferredPharmacy}</p>
                    </CardContent>
                  </Card>
                )}

                {patient.preferredLanguage && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Preferred Language</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{patient.preferredLanguage}</p>
                    </CardContent>
                  </Card>
                )}

                {patient.emergencyContact && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Emergency Contact</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="font-medium">{patient.emergencyContact}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Flags & Risks Tab */}
              <TabsContent value="flags" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Allergies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {patient.allergies &&
                    typeof patient.allergies === "object" &&
                    Object.keys(patient.allergies).length > 0 ? (
                      <div className="space-y-2">
                        {Object.entries(patient.allergies as Record<string, any>).map(
                          ([key, value]) => (
                            <div key={key} className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <span className="font-medium">{key}:</span>
                              <span className="text-sm text-muted-foreground">
                                {typeof value === "string" ? value : JSON.stringify(value)}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No known allergies</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Current Medications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {patient.medications && patient.medications.length > 0 ? (
                      <div className="space-y-2">
                        {patient.medications.map((med) => (
                          <div key={med.id} className="flex items-center justify-between p-2 border rounded">
                            <span className="font-medium">{med.name}</span>
                            <Badge variant="outline">{med.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No current medications</p>
                    )}
                  </CardContent>
                </Card>

                {patient.pastMedicalHistory && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Past Medical History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-wrap">
                        {typeof patient.pastMedicalHistory === "string"
                          ? patient.pastMedicalHistory
                          : JSON.stringify(patient.pastMedicalHistory, null, 2)}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {patient.familyHistory && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Family History</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-wrap">
                        {typeof patient.familyHistory === "string"
                          ? patient.familyHistory
                          : JSON.stringify(patient.familyHistory, null, 2)}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* History Tab */}
              <TabsContent value="history" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Intake History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {patient.intakeForms.length > 0 ? (
                      <div className="space-y-2">
                        {patient.intakeForms.map((form) => (
                          <div
                            key={form.id}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">{form.type}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(form.createdAt), "PPp")}
                              </p>
                            </div>
                            <Badge variant={form.status === "SUBMITTED" ? "default" : "secondary"}>
                              {form.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No intake forms</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Appointments</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {patient.appointments.length > 0 ? (
                      <div className="space-y-2">
                        {patient.appointments.slice(0, 5).map((apt) => (
                          <div
                            key={apt.id}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">
                                {apt.doctor.specialization || "Doctor"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(apt.scheduledAt), "PPp")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent appointments</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Labs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {patient.labOrders.length > 0 ? (
                      <div className="space-y-2">
                        {patient.labOrders.slice(0, 5).map((lab) => (
                          <div
                            key={lab.id}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <div>
                              <p className="font-medium">{lab.testName || "Lab Test"}</p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(lab.createdAt), "PPp")}
                              </p>
                            </div>
                            <Badge variant="outline">{lab.status}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent labs</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Select a patient to view profile</div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

