"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField, FormError } from "@/components/ui/form"
import { AppLayout } from "@/components/layouts"
import { useAuth } from "@/contexts/AuthContext"
import { Stethoscope, Loader2, AlertCircle } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function DoctorSignupPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    licenseNumber: "",
    npiNumber: "",
    specialization: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { refresh } = useAuth()
  const { toast } = useToast()

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.email) {
      newErrors.email = "Email is required"
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match"
    }

    if (!formData.licenseNumber) {
      newErrors.licenseNumber = "License number is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: "doctor",
          licenseNumber: formData.licenseNumber,
          npiNumber: formData.npiNumber || undefined,
          specialization: formData.specialization || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Signup failed")
      }

      // Refresh auth context
      await refresh()

      toast({
        title: "Account Created",
        description: "Your doctor account has been created and is pending admin approval.",
        variant: "success",
      })

      router.push("/doctor/pending")
    } catch (err: any) {
      setError(err.message || "An error occurred during signup")
      toast({
        title: "Signup Failed",
        description: err.message || "Please check your information and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout showBreadcrumbs={false}>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-2xl">
          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Stethoscope className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">Doctor Registration</CardTitle>
              <CardDescription>
                Create your DistanceDoc account to start providing telehealth services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
                <div className="flex gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900 dark:text-blue-100">
                    <p className="font-medium mb-1">Admin Approval Required</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      Doctor accounts require admin approval before you can access the platform. 
                      You'll receive an email notification once your account is approved.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <FormError message={error} />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Email" required error={errors.email}>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="doctor@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      disabled={loading}
                      required
                      autoComplete="email"
                    />
                  </FormField>

                  <FormField label="License Number" required error={errors.licenseNumber}>
                    <Input
                      id="licenseNumber"
                      name="licenseNumber"
                      type="text"
                      placeholder="MD12345"
                      value={formData.licenseNumber}
                      onChange={handleChange}
                      disabled={loading}
                      required
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Password" required error={errors.password}>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={formData.password}
                      onChange={handleChange}
                      disabled={loading}
                      required
                      autoComplete="new-password"
                    />
                  </FormField>

                  <FormField label="Confirm Password" required error={errors.confirmPassword}>
                    <Input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      disabled={loading}
                      required
                      autoComplete="new-password"
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="NPI Number" error={errors.npiNumber}>
                    <Input
                      id="npiNumber"
                      name="npiNumber"
                      type="text"
                      placeholder="1234567890"
                      value={formData.npiNumber}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormField>

                  <FormField label="Specialization" error={errors.specialization}>
                    <Input
                      id="specialization"
                      name="specialization"
                      type="text"
                      placeholder="e.g., Cardiology, Family Medicine"
                      value={formData.specialization}
                      onChange={handleChange}
                      disabled={loading}
                    />
                  </FormField>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Doctor Account"
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                <p className="text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

