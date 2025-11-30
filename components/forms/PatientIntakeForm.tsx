"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import {
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Save,
  Send,
  AlertCircle,
  Camera,
} from "lucide-react"
import type { FormQuestion, FormResponse } from "@/lib/forms/types"

interface PatientIntakeFormProps {
  questions: FormQuestion[]
  title: string
  description?: string
  onSubmit: (responses: FormResponse[], uploadedFiles?: string[]) => Promise<void>
  formId: string
  consultationId?: string
  initialResponses?: FormResponse[]
}

export function PatientIntakeForm({
  questions,
  title,
  description,
  onSubmit,
  formId,
  consultationId,
  initialResponses = [],
}: PatientIntakeFormProps) {
  const [responses, setResponses] = useState<Record<string, any>>(
    initialResponses.reduce((acc, r) => ({ ...acc, [r.questionId]: r.value }), {})
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate progress
  const answeredCount = questions.filter((q) => {
    const value = responses[q.id]
    if (q.required) {
      if (value === undefined || value === null || value === "") return false
      if (q.type === "multiselect" && (!Array.isArray(value) || value.length === 0)) return false
    }
    return value !== undefined && value !== null && value !== ""
  }).length

  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0

  // Auto-save functionality
  useEffect(() => {
    if (Object.keys(responses).length === 0) return

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Set new timeout for autosave (2 seconds after last change)
    autosaveTimeoutRef.current = setTimeout(() => {
      handleAutoSave()
    }, 2000)

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [responses])

  const handleAutoSave = useCallback(async () => {
    try {
      setIsSaving(true)
      // Save to localStorage as backup
      localStorage.setItem(`form-${formId}-responses`, JSON.stringify(responses))
      
      // Optionally save to backend (if you have a draft endpoint)
      // await fetch(`/api/forms/${formId}/draft`, { method: 'PUT', body: JSON.stringify({ responses }) })
    } catch (error) {
      console.error("Auto-save error:", error)
    } finally {
      setIsSaving(false)
    }
  }, [responses, formId])

  // Load saved responses from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`form-${formId}-responses`)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setResponses((prev) => ({ ...prev, ...parsed }))
      } catch (error) {
        console.error("Error loading saved responses:", error)
      }
    }
  }, [formId])

  const updateResponse = useCallback((questionId: string, value: any) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }))
    // Clear error when user starts typing
    if (errors[questionId]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[questionId]
        return newErrors
      })
    }
  }, [errors])

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    questions.forEach((question) => {
      const value = responses[question.id]

      if (question.required) {
        if (value === undefined || value === null || value === "") {
          newErrors[question.id] = "This field is required"
          return
        }
        if (question.type === "multiselect" && (!Array.isArray(value) || value.length === 0)) {
          newErrors[question.id] = "Please select at least one option"
          return
        }
      }

      if (value !== undefined && value !== null && value !== "") {
        if (question.type === "text" || question.type === "textarea") {
          const strValue = String(value)
          if (question.validation?.minLength && strValue.length < question.validation.minLength) {
            newErrors[question.id] = `Minimum length is ${question.validation.minLength} characters`
          }
          if (question.validation?.maxLength && strValue.length > question.validation.maxLength) {
            newErrors[question.id] = `Maximum length is ${question.validation.maxLength} characters`
          }
        }
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [questions, responses])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ]

    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (JPEG, PNG, GIF, or WebP)",
        variant: "destructive",
      })
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB",
        variant: "destructive",
      })
      return
    }

    setUploading(true)

    try {
      // Step 1: Get signed upload URL
      const urlResponse = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          category: "Intake Form Photo",
          consultationId,
        }),
      })

      if (!urlResponse.ok) {
        const error = await urlResponse.json()
        throw new Error(error.error || "Failed to get upload URL")
      }

      const { uploadUrl, fileId } = await urlResponse.json()

      // Step 2: Upload file directly to Cloud Storage
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file to storage")
      }

      // Step 3: Confirm upload completion
      const confirmResponse = await fetch("/api/files/upload-url", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ fileId }),
      })

      if (!confirmResponse.ok) {
        throw new Error("Failed to confirm upload")
      }

      const fileRecord = await confirmResponse.json()
      setUploadedFiles((prev) => [...prev, fileRecord.id])
      
      toast({
        title: "Upload Successful",
        description: "Image uploaded successfully",
        variant: "success",
      })

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    } catch (error: any) {
      console.error("Upload error:", error)
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload image. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      // Scroll to first error
      const firstErrorId = Object.keys(errors)[0]
      if (firstErrorId) {
        document.getElementById(`question-${firstErrorId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
      }
      return
    }

    setIsSubmitting(true)
    try {
      const formResponses: FormResponse[] = questions.map((q) => ({
        questionId: q.id,
        value: responses[q.id] ?? (q.type === "multiselect" ? [] : ""),
      }))

      await onSubmit(formResponses, uploadedFiles)
      
      // Clear saved responses after successful submit
      localStorage.removeItem(`form-${formId}-responses`)
    } catch (error: any) {
      console.error("Error submitting form:", error)
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit form. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }, [questions, responses, uploadedFiles, validate, onSubmit, formId, toast, errors])

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h1 className="text-xl font-bold">{title}</h1>
              {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
            </div>
            {isSaving && (
              <Badge variant="secondary" className="gap-2">
                <Save className="h-3 w-3 animate-spin" />
                Saving...
              </Badge>
            )}
          </div>
          
          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{answeredCount} of {questions.length} answered</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">
        {questions.map((question, index) => (
          <QuestionField
            key={question.id}
            question={question}
            index={index}
            value={responses[question.id]}
            onChange={(value) => updateResponse(question.id, value)}
            error={errors[question.id]}
          />
        ))}

        {/* Image Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Upload Photos (Optional)
            </CardTitle>
            <CardDescription>
              Upload photos of symptoms, rashes, or other relevant images for your doctor to review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
                id="image-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full"
              >
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 mr-2 animate-pulse" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Choose Photo
                  </>
                )}
              </Button>
            </div>
            {uploadedFiles.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{uploadedFiles.length} photo{uploadedFiles.length > 1 ? "s" : ""} uploaded</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fixed Submit Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-20">
        <div className="container mx-auto max-w-2xl">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || progress < 100}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-pulse" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Form
              </>
            )}
          </Button>
          {progress < 100 && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Please answer all required questions to submit
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

// Question Field Component
function QuestionField({
  question,
  index,
  value,
  onChange,
  error,
}: {
  question: FormQuestion
  index: number
  value: any
  onChange: (value: any) => void
  error?: string
}) {
  return (
    <Card id={`question-${question.id}`} className={error ? "border-destructive" : ""}>
      <CardContent className="p-4 space-y-3">
        <Label htmlFor={`field-${question.id}`} className="text-base font-medium">
          {index + 1}. {question.label}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {question.type === "text" && (
          <Input
            id={`field-${question.id}`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder || "Enter your answer"}
            className={error ? "border-destructive" : ""}
          />
        )}

        {question.type === "textarea" && (
          <Textarea
            id={`field-${question.id}`}
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={question.placeholder || "Enter your answer"}
            rows={4}
            className={error ? "border-destructive" : ""}
          />
        )}

        {question.type === "yesno" && (
          <RadioGroup
            value={value === true ? "yes" : value === false ? "no" : undefined}
            onValueChange={(val) => onChange(val === "yes")}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id={`yes-${question.id}`} />
              <Label htmlFor={`yes-${question.id}`} className="cursor-pointer font-normal">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id={`no-${question.id}`} />
              <Label htmlFor={`no-${question.id}`} className="cursor-pointer font-normal">
                No
              </Label>
            </div>
          </RadioGroup>
        )}

        {question.type === "scale" && (
          <div className="space-y-3">
            <Slider
              value={[value ?? question.scaleMin ?? 1]}
              onValueChange={(vals) => onChange(vals[0])}
              min={question.scaleMin ?? 1}
              max={question.scaleMax ?? 10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{question.scaleLabelMin || question.scaleMin || 1}</span>
              <span className="font-medium text-foreground">{value ?? question.scaleMin ?? 1}</span>
              <span>{question.scaleLabelMax || question.scaleMax || 10}</span>
            </div>
          </div>
        )}

        {question.type === "multiselect" && (
          <div className="space-y-2">
            {question.options?.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <Checkbox
                  id={`option-${question.id}-${idx}`}
                  checked={(value as string[])?.includes(option) || false}
                  onCheckedChange={(checked) => {
                    const current = (value as string[]) || []
                    if (checked) {
                      onChange([...current, option])
                    } else {
                      onChange(current.filter((v) => v !== option))
                    }
                  }}
                />
                <Label
                  htmlFor={`option-${question.id}-${idx}`}
                  className="cursor-pointer font-normal"
                >
                  {option}
                </Label>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

