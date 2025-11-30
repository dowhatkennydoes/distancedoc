"use client"

import { FormBuilder } from "@/components/forms/FormBuilder"
import { DoctorDashboardLayout } from "@/components/layouts"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import type { FormQuestion } from "@/lib/forms/types"

export default function DoctorFormsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formType, setFormType] = useState<"INITIAL" | "FOLLOW_UP" | "PRE_VISIT" | "POST_VISIT" | "ANNUAL">(
    (searchParams.get("type") as any) || "PRE_VISIT"
  )

  useEffect(() => {
    if (!loading && (!user || user.role !== "doctor")) {
      router.push("/dashboard")
    }
  }, [user, loading, router])

  if (loading || !user || user.role !== "doctor") {
    return (
      <DoctorDashboardLayout>
        <PageSkeleton />
      </DoctorDashboardLayout>
    )
  }

  const handleSave = async (questions: FormQuestion[], title: string, description?: string) => {
    const response = await fetch("/api/forms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        type: formType,
        title,
        description,
        questions,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || "Failed to save form")
    }

    const form = await response.json()
    router.push(`/doctor/forms/${form.id}`)
  }

  return (
    <DoctorDashboardLayout>
      <FormBuilder formType={formType} onSave={handleSave} />
    </DoctorDashboardLayout>
  )
}

