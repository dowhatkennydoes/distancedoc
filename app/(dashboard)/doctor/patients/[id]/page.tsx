"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { DoctorDashboardLayout } from "@/components/layouts"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import {
  ArrowLeft,
  User,
  Calendar,
  FileText,
  Pill,
  FlaskConical,
  Folder,
  StickyNote,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  AlertCircle,
  Download,
  Eye,
} from "lucide-react"
import { format, differenceInYears, parseISO } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import Link from "next/link"

interface PatientData {
  id: string
  name: string
  email?: string
  dateOfBirth: string
  gender?: string
  phoneNumber?: string
  address?: string
  emergencyContact?: string
  insuranceProvider?: string
  insuranceMemberId?: string
  medicalHistory?: string
  allergies: string[]
}

export default function PatientProfilePage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [patientData, setPatientData] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)

  // Sample/placeholder data
  const sampleData = {
    demographics: {
      id: params.id as string,
      name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      dateOfBirth: "1985-03-15",
      gender: "Female",
      phoneNumber: "+1 (555) 123-4567",
      address: "123 Main Street, Anytown, ST 12345",
      emergencyContact: "John Johnson - +1 (555) 123-4568 (Spouse)",
      insuranceProvider: "Blue Cross Blue Shield",
      insuranceMemberId: "BC123456789",
      medicalHistory: "Hypertension, Type 2 Diabetes (controlled), Seasonal allergies",
      allergies: ["Penicillin", "Latex", "Shellfish"],
    },
    visitHistory: [
      {
        id: "1",
        date: "2024-01-15",
        type: "VIDEO",
        reason: "Follow-up for diabetes management",
        status: "COMPLETED",
        visitNote: true,
      },
      {
        id: "2",
        date: "2023-12-10",
        type: "VIDEO",
        reason: "Annual physical examination",
        status: "COMPLETED",
        visitNote: true,
      },
      {
        id: "3",
        date: "2023-11-05",
        type: "PHONE",
        reason: "Medication refill consultation",
        status: "COMPLETED",
        visitNote: false,
      },
    ],
    intakeForms: [
      {
        id: "1",
        type: "PRE_VISIT",
        submittedAt: "2024-01-10",
        status: "REVIEWED",
        chiefComplaint: "Routine follow-up",
      },
      {
        id: "2",
        type: "INITIAL",
        submittedAt: "2023-12-05",
        status: "REVIEWED",
        chiefComplaint: "Annual physical",
      },
    ],
    medications: [
      {
        id: "1",
        name: "Metformin",
        dosage: "500mg",
        frequency: "Twice daily",
        route: "Oral",
        startDate: "2023-06-01",
        status: "ACTIVE",
        prescribedBy: "Dr. Smith",
      },
      {
        id: "2",
        name: "Lisinopril",
        dosage: "10mg",
        frequency: "Once daily",
        route: "Oral",
        startDate: "2023-08-15",
        status: "ACTIVE",
        prescribedBy: "Dr. Smith",
      },
      {
        id: "3",
        name: "Loratadine",
        dosage: "10mg",
        frequency: "As needed",
        route: "Oral",
        startDate: "2023-05-01",
        status: "ACTIVE",
        prescribedBy: "Dr. Smith",
      },
    ],
    labs: [
      {
        id: "1",
        testName: "Hemoglobin A1C",
        orderDate: "2024-01-15",
        resultDate: "2024-01-18",
        status: "COMPLETED",
        results: "6.2% (Normal range: <5.7%)",
      },
      {
        id: "2",
        testName: "Complete Blood Count (CBC)",
        orderDate: "2024-01-15",
        resultDate: "2024-01-17",
        status: "COMPLETED",
        results: "All values within normal limits",
      },
      {
        id: "3",
        testName: "Lipid Panel",
        orderDate: "2023-12-10",
        resultDate: "2023-12-12",
        status: "COMPLETED",
        results: "Total Cholesterol: 185 mg/dL (Normal)",
      },
    ],
    files: [
      {
        id: "1",
        fileName: "Lab_Results_2024-01-18.pdf",
        category: "lab_result",
        uploadedAt: "2024-01-18",
        fileSize: 245760,
      },
      {
        id: "2",
        fileName: "Insurance_Card_Front.jpg",
        category: "insurance",
        uploadedAt: "2023-12-01",
        fileSize: 512000,
      },
      {
        id: "3",
        fileName: "Previous_Medical_Records.pdf",
        category: "medical_record",
        uploadedAt: "2023-11-15",
        fileSize: 1024000,
      },
    ],
    notes: [
      {
        id: "1",
        date: "2024-01-15",
        type: "Visit Note",
        title: "Diabetes Follow-up",
        content: "Patient reports good glucose control. Continue current medication regimen. Schedule follow-up in 3 months.",
      },
      {
        id: "2",
        date: "2023-12-10",
        type: "Visit Note",
        title: "Annual Physical",
        content: "Patient in good health. All vitals normal. Continue current medications. Recommended annual labs completed.",
      },
      {
        id: "3",
        date: "2023-11-05",
        type: "Clinical Note",
        title: "Medication Refill",
        content: "Patient requested refill for Metformin. Approved. No changes to dosage.",
      },
    ],
  }

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!user || user.role !== "doctor") return

      try {
        const response = await fetch(`/api/patients/${params.id}`, {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          setPatientData(data)
        } else {
          // Use sample data as placeholder
          setPatientData(sampleData.demographics as PatientData)
        }
      } catch (error) {
        console.error("Error fetching patient data:", error)
        // Use sample data as placeholder
        setPatientData(sampleData.demographics as PatientData)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchPatientData()
    }
  }, [user, authLoading, params.id])

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <PageSkeleton />
      </DoctorDashboardLayout>
    )
  }

  const calculateAge = (dateOfBirth: string) => {
    try {
      return differenceInYears(new Date(), parseISO(dateOfBirth))
    } catch {
      return "N/A"
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      COMPLETED: { variant: "default", label: "Completed" },
      ACTIVE: { variant: "default", label: "Active" },
      REVIEWED: { variant: "default", label: "Reviewed" },
      SUBMITTED: { variant: "secondary", label: "Submitted" },
      DRAFT: { variant: "outline", label: "Draft" },
    }

    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  const patient = patientData || sampleData.demographics

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{patient.name}</h1>
            <p className="text-muted-foreground mt-1">
              Patient Profile • Age {calculateAge(patient.dateOfBirth)}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="demographics" className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="demographics">Demographics</TabsTrigger>
            <TabsTrigger value="visits">Visits</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
            <TabsTrigger value="medications">Medications</TabsTrigger>
            <TabsTrigger value="labs">Labs</TabsTrigger>
            <TabsTrigger value="files">Files</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
          </TabsList>

          {/* Demographics Tab */}
          <TabsContent value="demographics" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Name:</span>
                      <span>{patient.name}</span>
                    </div>
                    {patient.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Email:</span>
                        <span>{patient.email}</span>
                      </div>
                    )}
                    {patient.phoneNumber && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Phone:</span>
                        <span>{patient.phoneNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Date of Birth:</span>
                      <span>{format(parseISO(patient.dateOfBirth), "MMMM d, yyyy")}</span>
                    </div>
                    {patient.gender && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Gender:</span>
                        <span>{patient.gender}</span>
                      </div>
                    )}
                    {patient.address && (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Address:</span>
                          <p className="text-muted-foreground">{patient.address}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Insurance & Emergency</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patient.insuranceProvider && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Insurance:</span>
                        <span>{patient.insuranceProvider}</span>
                      </div>
                      {patient.insuranceMemberId && (
                        <div className="text-sm text-muted-foreground ml-6">
                          Member ID: {patient.insuranceMemberId}
                        </div>
                      )}
                    </div>
                  )}
                  {patient.emergencyContact && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Emergency Contact:</span>
                      </div>
                      <p className="text-sm text-muted-foreground ml-6">
                        {patient.emergencyContact}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>Medical Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {patient.allergies && patient.allergies.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        Allergies
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {patient.allergies.map((allergy, index) => (
                          <Badge key={index} variant="destructive">
                            {allergy}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {patient.medicalHistory && (
                    <div>
                      <h4 className="font-medium mb-2">Medical History</h4>
                      <p className="text-sm text-muted-foreground">{patient.medicalHistory}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Visit History Tab */}
          <TabsContent value="visits" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Visit History</CardTitle>
                <CardDescription>Past appointments and consultations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleData.visitHistory.map((visit) => (
                      <TableRow key={visit.id}>
                        <TableCell>{format(parseISO(visit.date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="capitalize">{visit.type.toLowerCase()}</TableCell>
                        <TableCell>{visit.reason}</TableCell>
                        <TableCell>{getStatusBadge(visit.status)}</TableCell>
                        <TableCell>
                          {visit.visitNote && (
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-2" />
                              View Note
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Intake Forms Tab */}
          <TabsContent value="forms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Intake Forms</CardTitle>
                <CardDescription>Patient intake and assessment forms</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sampleData.intakeForms.map((form) => (
                    <Card key={form.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg capitalize">
                              {form.type.replace("_", " ")}
                            </CardTitle>
                            <CardDescription>
                              Submitted: {format(parseISO(form.submittedAt), "MMM d, yyyy")}
                            </CardDescription>
                          </div>
                          {getStatusBadge(form.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm">
                          <span className="font-medium">Chief Complaint:</span> {form.chiefComplaint}
                        </p>
                        <Button variant="outline" size="sm" className="mt-4">
                          <FileText className="h-4 w-4 mr-2" />
                          View Form
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medications Tab */}
          <TabsContent value="medications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Current Medications</CardTitle>
                <CardDescription>Active and past medications</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medication</TableHead>
                      <TableHead>Dosage</TableHead>
                      <TableHead>Frequency</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleData.medications.map((med) => (
                      <TableRow key={med.id}>
                        <TableCell className="font-medium">{med.name}</TableCell>
                        <TableCell>{med.dosage}</TableCell>
                        <TableCell>{med.frequency}</TableCell>
                        <TableCell className="capitalize">{med.route.toLowerCase()}</TableCell>
                        <TableCell>{getStatusBadge(med.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Labs Tab */}
          <TabsContent value="labs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lab Results</CardTitle>
                <CardDescription>Laboratory test orders and results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sampleData.labs.map((lab) => (
                    <Card key={lab.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{lab.testName}</CardTitle>
                            <CardDescription>
                              Ordered: {format(parseISO(lab.orderDate), "MMM d, yyyy")}
                              {lab.resultDate &&
                                ` • Results: ${format(parseISO(lab.resultDate), "MMM d, yyyy")}`}
                            </CardDescription>
                          </div>
                          {getStatusBadge(lab.status)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        {lab.results && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Results:</p>
                            <p className="text-sm text-muted-foreground">{lab.results}</p>
                          </div>
                        )}
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Medical Files</CardTitle>
                <CardDescription>Uploaded documents and records</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleData.files.map((file) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.fileName}</TableCell>
                        <TableCell className="capitalize">
                          {file.category.replace("_", " ")}
                        </TableCell>
                        <TableCell>{formatFileSize(file.fileSize)}</TableCell>
                        <TableCell>
                          {format(parseISO(file.uploadedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Clinical Notes</CardTitle>
                <CardDescription>Visit notes and clinical documentation</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {sampleData.notes.map((note) => (
                    <Card key={note.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{note.title}</CardTitle>
                            <CardDescription>
                              {format(parseISO(note.date), "MMM d, yyyy")} • {note.type}
                            </CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{note.content}</p>
                        <Button variant="outline" size="sm" className="mt-4">
                          <StickyNote className="h-4 w-4 mr-2" />
                          View Full Note
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DoctorDashboardLayout>
  )
}

