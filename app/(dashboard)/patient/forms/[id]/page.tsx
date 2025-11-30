"use client"

import { PatientIntakeForm } from "@/components/forms/PatientIntakeForm"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { FormQuestion, FormResponse } from "@/lib/forms/types"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import { useToast } from "@/components/ui/use-toast"

export default function PatientFormPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [form, setForm] = useState<any>(null)
  const [loadingForm, setLoadingForm] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== "patient")) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchForm = async () => {
      try {
        const response = await fetch(`/api/forms/${params.id}`, {
          credentials: "include",
        })
        if (!response.ok) {
          router.push("/dashboard")
          return
        }
        const formData = await response.json()
        setForm(formData)
      } catch (error) {
        console.error("Error fetching form:", error)
        router.push("/dashboard")
      } finally {
        setLoadingForm(false)
      }
    }

    if (user) {
      fetchForm()
    }
  }, [params.id, user, router])

  if (loading || loadingForm || !user || user.role !== "patient") {
    return <PageSkeleton />
  }

  if (!form) {
    return (
      <div className="container mx-auto py-8 text-center">
        <p className="text-muted-foreground">Form not found</p>
      </div>
    )
  }

  const formData = form.formData as any
  const consultationId = searchParams.get("consultationId")

  const handleSubmit = async (responses: FormResponse[], uploadedFiles?: string[]) => {
    if (!consultationId) {
      toast({
        title: "Error",
        description: "Consultation ID is required",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/forms/${params.id}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          consultationId,
          responses,
          uploadedFiles,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to submit form")
      }

      toast({
        title: "Success",
        description: "Form submitted successfully!",
        variant: "success",
      })
      
      router.push("/patient/forms")
    } catch (error: any) {
      console.error("Error submitting form:", error)
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit form. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <PatientIntakeForm
      questions={(formData.questions || []) as FormQuestion[]}
      title={formData.title || "Intake Form"}
      description={formData.description}
      onSubmit={handleSubmit}
      formId={params.id}
      consultationId={consultationId || undefined}
    />
  )
}

