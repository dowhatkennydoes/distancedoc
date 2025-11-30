"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormField, FormError } from "@/components/ui/form"
import { AppLayout } from "@/components/layouts"
import { Loader2, CheckCircle2, Mail, ArrowLeft } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { createClient } from "@/lib/supabase/client"

export default function ResetPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mode, setMode] = useState<"request" | "reset">("request")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    // Check if we have a reset token in the URL
    const token = searchParams.get("token")
    const type = searchParams.get("type")
    
    if (token && type === "recovery") {
      setMode("reset")
    }
  }, [searchParams])

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset?type=recovery`,
      })

      if (resetError) {
        throw resetError
      }

      setSuccess(true)
      toast({
        title: "Reset Email Sent",
        description: "Check your email for password reset instructions.",
        variant: "success",
      })
    } catch (err: any) {
      setError(err.message || "Failed to send reset email")
      toast({
        title: "Error",
        description: err.message || "Failed to send reset email. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        throw updateError
      }

      toast({
        title: "Password Updated",
        description: "Your password has been successfully updated.",
        variant: "success",
      })

      // Redirect to login after a short delay
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "Failed to reset password")
      toast({
        title: "Error",
        description: err.message || "Failed to reset password. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  if (success && mode === "request") {
    return (
      <AppLayout showBreadcrumbs={false}>
        <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12">
          <div className="w-full max-w-md">
            <Card>
              <CardHeader className="space-y-1 text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20 mx-auto">
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
                <CardDescription>
                  We've sent password reset instructions to <strong>{email}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <div className="flex gap-3">
                      <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium mb-1">What's next?</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          <li>Check your inbox for an email from DistanceDoc</li>
                          <li>Click the reset link in the email</li>
                          <li>Create a new password</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" asChild>
                    <Link href="/login">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Login
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout showBreadcrumbs={false}>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Mail className="h-6 w-6" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">
                {mode === "request" ? "Reset Password" : "Set New Password"}
              </CardTitle>
              <CardDescription>
                {mode === "request"
                  ? "Enter your email address and we'll send you a reset link"
                  : "Enter your new password below"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mode === "request" ? (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <FormError message={error} />

                  <FormField label="Email" required>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="email"
                    />
                  </FormField>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <FormError message={error} />

                  <FormField label="New Password" required>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="new-password"
                    />
                  </FormField>

                  <FormField label="Confirm New Password" required>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      required
                      autoComplete="new-password"
                    />
                  </FormField>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      "Update Password"
                    )}
                  </Button>
                </form>
              )}

              <div className="mt-6 text-center text-sm">
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium"
                >
                  <ArrowLeft className="inline h-4 w-4 mr-1" />
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}

