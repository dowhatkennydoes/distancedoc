"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { DoctorDashboardLayout } from "@/components/layouts"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/contexts/AuthContext"
import {
  FileText,
  Download,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Save,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

interface SOAPNote {
  id: string
  appointmentId: string
  patientName: string
  chiefComplaint?: string
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  diagnosis?: string[]
  procedures?: string[]
  risks?: string[]
  followUpDate?: string
  aiGenerated: boolean
  aiModel?: string
  signedAt?: string
  signedBy?: string
  createdAt: string
  updatedAt: string
}

export default function SOAPNoteViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [soapNote, setSoapNote] = useState<SOAPNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Sample/placeholder data
  const sampleSOAPNote: SOAPNote = {
    id: params.id as string,
    appointmentId: "apt-123",
    patientName: "Sarah Johnson",
    chiefComplaint: "Follow-up for diabetes management and routine check-up",
    subjective: `Patient is a 38-year-old female presenting for routine follow-up of Type 2 Diabetes Mellitus. 
    
Reports good adherence to current medication regimen (Metformin 500mg BID). Denies any new symptoms. 
States blood glucose monitoring shows readings typically between 90-130 mg/dL fasting. 
No episodes of hypoglycemia. No polyuria, polydipsia, or polyphagia. 
No vision changes, numbness, or tingling in extremities. 
Diet and exercise routine unchanged.`,
    objective: `Vital Signs:
- Blood Pressure: 128/82 mmHg
- Heart Rate: 72 bpm, regular
- Respiratory Rate: 16/min
- Temperature: 98.6°F
- Weight: 165 lbs (stable)
- BMI: 28.5

Physical Examination:
- General: Well-appearing, in no acute distress
- HEENT: Normocephalic, atraumatic
- Cardiovascular: Regular rate and rhythm, no murmurs
- Respiratory: Clear to auscultation bilaterally
- Abdomen: Soft, non-tender, non-distended
- Extremities: No edema, pulses intact
- Neurological: Alert and oriented, cranial nerves II-XII intact

Recent Labs (from 2024-01-15):
- Hemoglobin A1C: 6.2% (down from 6.5% three months ago)
- Fasting Glucose: 108 mg/dL
- Lipid Panel: Total Cholesterol 185 mg/dL, LDL 110 mg/dL, HDL 55 mg/dL, Triglycerides 150 mg/dL`,
    assessment: `1. Type 2 Diabetes Mellitus, well-controlled (A1C 6.2%)
   - Good glycemic control with current medication regimen
   - No acute complications

2. Hypertension, controlled
   - Blood pressure within target range on current medication

3. Hyperlipidemia, mild
   - LDL slightly elevated, may consider statin if not already on one`,
    plan: `1. Continue Metformin 500mg twice daily with meals
   - Patient tolerating well, no side effects reported

2. Continue Lisinopril 10mg once daily for blood pressure control
   - BP well-controlled on current dose

3. Lifestyle modifications:
   - Continue current diet and exercise routine
   - Reinforce importance of regular physical activity (30 min, 5x/week)
   - Dietary counseling: Continue low-carb, high-fiber diet

4. Laboratory follow-up:
   - Repeat Hemoglobin A1C in 3 months
   - Annual comprehensive metabolic panel and lipid panel

5. Patient education:
   - Reviewed diabetes self-management
   - Discussed importance of regular monitoring
   - Provided educational materials

6. Follow-up: Schedule next appointment in 3 months or sooner if concerns arise`,
    diagnosis: ["E11.9", "I10"],
    procedures: ["99213"],
    risks: [
      "Potential for diabetic complications if glycemic control deteriorates",
      "Risk of cardiovascular events given diabetes and hypertension",
      "Monitor for medication side effects",
    ],
    followUpDate: "2024-04-15",
    aiGenerated: true,
    aiModel: "gemini-1.5-flash",
    createdAt: "2024-01-15T10:00:00Z",
    updatedAt: "2024-01-15T10:30:00Z",
  }

  useEffect(() => {
    const fetchSOAPNote = async () => {
      if (!user || user.role !== "doctor") return

      try {
        const response = await fetch(`/api/visit-notes/${params.id}`, {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          setSoapNote(data)
        } else {
          // Use sample data as placeholder
          setSoapNote(sampleSOAPNote)
        }
      } catch (error) {
        console.error("Error fetching SOAP note:", error)
        // Use sample data as placeholder
        setSoapNote(sampleSOAPNote)
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchSOAPNote()
    }
  }, [user, authLoading, params.id])

  // Autosave functionality
  useEffect(() => {
    if (!isEditing || !hasUnsavedChanges || !soapNote) return

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Set new timeout for autosave (3 seconds after last change)
    autosaveTimeoutRef.current = setTimeout(() => {
      handleSave()
    }, 3000)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [soapNote, isEditing, hasUnsavedChanges])

  const handleFieldChange = (field: keyof SOAPNote, value: string) => {
    if (!soapNote) return
    setSoapNote({ ...soapNote, [field]: value })
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!soapNote) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/visit-notes/${soapNote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subjective: soapNote.subjective,
          objective: soapNote.objective,
          assessment: soapNote.assessment,
          plan: soapNote.plan,
          diagnosis: soapNote.diagnosis,
          procedures: soapNote.procedures,
        }),
      })

      if (response.ok) {
        setHasUnsavedChanges(false)
        toast({
          title: "Saved",
          description: "SOAP note has been saved successfully.",
          variant: "success",
        })
      } else {
        throw new Error("Failed to save")
      }
    } catch (error) {
      toast({
        title: "Save Error",
        description: "Failed to save SOAP note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleApprove = async () => {
    if (!soapNote) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/visit-notes/${soapNote.id}/approve`, {
        method: "POST",
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setSoapNote({ ...soapNote, signedAt: data.signedAt, signedBy: data.signedBy })
        setIsEditing(false)
        toast({
          title: "Approved",
          description: "SOAP note has been approved and signed.",
          variant: "success",
        })
      } else {
        throw new Error("Failed to approve")
      }
    } catch (error) {
      toast({
        title: "Approval Error",
        description: "Failed to approve SOAP note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDownloadPDF = () => {
    // TODO: Implement PDF generation
    toast({
      title: "PDF Download",
      description: "PDF download functionality coming soon.",
      variant: "default",
    })
  }

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <PageSkeleton />
      </DoctorDashboardLayout>
    )
  }

  if (!soapNote) {
    return (
      <DoctorDashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">SOAP note not found</p>
        </div>
      </DoctorDashboardLayout>
    )
  }

  const isSigned = !!soapNote.signedAt

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">SOAP Note</h1>
            <p className="text-muted-foreground mt-2">
              {soapNote.patientName} • {format(parseISO(soapNote.createdAt), "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isSaving && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </div>
            )}
            {hasUnsavedChanges && !isSaving && (
              <Badge variant="secondary">Unsaved changes</Badge>
            )}
            {isSigned && (
              <Badge variant="default" className="gap-2">
                <CheckCircle2 className="h-3 w-3" />
                Signed
              </Badge>
            )}
            {soapNote.aiGenerated && (
              <Badge variant="secondary">AI Generated</Badge>
            )}
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            {!isSigned && (
              <>
                {isEditing ? (
                  <Button onClick={handleSave} disabled={isSaving}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                <Button onClick={handleApprove} disabled={isSaving || isEditing}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve & Sign
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Chief Complaint */}
        {soapNote.chiefComplaint && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Chief Complaint</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{soapNote.chiefComplaint}</p>
            </CardContent>
          </Card>
        )}

        {/* Risk Warnings - Accordion */}
        {soapNote.risks && soapNote.risks.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-800">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <CardTitle className="text-lg text-yellow-900 dark:text-yellow-100">
                  Risk Warnings
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {soapNote.risks.map((risk, index) => (
                  <AccordionItem key={index} value={`risk-${index}`}>
                    <AccordionTrigger className="text-left text-sm text-yellow-900 dark:text-yellow-100 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                        <span className="font-medium">Risk {index + 1}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-yellow-900 dark:text-yellow-100 pt-2">
                      {risk}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* SOAP Note Tabs */}
        <Card>
          <Tabs defaultValue="subjective" className="w-full">
            <CardHeader>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="subjective">Subjective</TabsTrigger>
                <TabsTrigger value="objective">Objective</TabsTrigger>
                <TabsTrigger value="assessment">Assessment</TabsTrigger>
                <TabsTrigger value="plan">Plan</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="subjective" className="mt-4">
                {isEditing ? (
                  <Textarea
                    value={soapNote.subjective || ""}
                    onChange={(e) => handleFieldChange("subjective", e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Enter subjective information..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {soapNote.subjective || "No subjective information documented."}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="objective" className="mt-4">
                {isEditing ? (
                  <Textarea
                    value={soapNote.objective || ""}
                    onChange={(e) => handleFieldChange("objective", e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Enter objective findings..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {soapNote.objective || "No objective findings documented."}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="assessment" className="mt-4">
                {isEditing ? (
                  <Textarea
                    value={soapNote.assessment || ""}
                    onChange={(e) => handleFieldChange("assessment", e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Enter assessment and diagnosis..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {soapNote.assessment || "No assessment documented."}
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="plan" className="mt-4">
                {isEditing ? (
                  <Textarea
                    value={soapNote.plan || ""}
                    onChange={(e) => handleFieldChange("plan", e.target.value)}
                    className="min-h-[300px] font-mono text-sm"
                    placeholder="Enter treatment plan..."
                  />
                ) : (
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {soapNote.plan || "No treatment plan documented."}
                    </p>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Additional Information */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Diagnosis Codes */}
          {soapNote.diagnosis && soapNote.diagnosis.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Diagnosis Codes (ICD-10)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {soapNote.diagnosis.map((code, index) => (
                    <Badge key={index} variant="outline">
                      {code}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Procedure Codes */}
          {soapNote.procedures && soapNote.procedures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Procedure Codes (CPT)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {soapNote.procedures.map((code, index) => (
                    <Badge key={index} variant="outline">
                      {code}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Note Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 text-sm">
              <div>
                <span className="font-medium">Created:</span>{" "}
                {format(parseISO(soapNote.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
              <div>
                <span className="font-medium">Last Updated:</span>{" "}
                {format(parseISO(soapNote.updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
              {soapNote.aiGenerated && (
                <div>
                  <span className="font-medium">AI Model:</span> {soapNote.aiModel || "Unknown"}
                </div>
              )}
              {soapNote.followUpDate && (
                <div>
                  <span className="font-medium">Follow-up Date:</span>{" "}
                  {format(parseISO(soapNote.followUpDate), "MMM d, yyyy")}
                </div>
              )}
              {isSigned && soapNote.signedAt && (
                <div>
                  <span className="font-medium">Signed:</span>{" "}
                  {format(parseISO(soapNote.signedAt), "MMM d, yyyy 'at' h:mm a")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DoctorDashboardLayout>
  )
}

