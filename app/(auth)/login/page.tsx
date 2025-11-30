"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { FormField, FormError } from "@/components/ui/form"
import { AppLayout } from "@/components/layouts"
import { useAuth } from "@/contexts/AuthContext"
import { Stethoscope, User, Loader2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setUser } = useAuth()
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Login failed")
      }

      // Update auth context directly with user data from login response
      // This avoids an unnecessary API call to /api/auth/session
      if (data.user) {
        setUser(data.user)
      }

      // Handle doctor approval pending
      if (data.user.role === "doctor" && !data.user.metadata?.approved) {
        toast({
          title: "Account Pending Approval",
          description: "Your doctor account is pending admin approval. You'll be notified once approved.",
          variant: "warning",
        })
        router.push("/doctor/pending")
        return
      }

      // Redirect to appropriate dashboard
      const redirect = searchParams.get("redirect") || (data.user.role === "patient" ? "/patient" : "/dashboard")
      router.push(redirect)
      
      toast({
        title: "Welcome back!",
        description: "You've successfully logged in.",
        variant: "success",
      })
    } catch (err: any) {
      setError(err.message || "An error occurred during login")
      toast({
        title: "Login Failed",
        description: err.message || "Please check your credentials and try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout showBreadcrumbs={false}>
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center py-12">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="space-y-1 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="text-xl font-bold">DD</span>
                </div>
              </div>
              <CardTitle className="text-3xl font-bold">Welcome Back</CardTitle>
              <CardDescription>
                Sign in to your DistanceDoc account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
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

                <FormField label="Password" required>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    autoComplete="current-password"
                  />
                </FormField>

                <div className="flex items-center justify-between">
                  <Link
                    href="/reset"
                    className="text-sm text-primary hover:underline"
                  >
                    Forgot password?
                  </Link>
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
                      Signing in...
                    </>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      New to DistanceDoc?
                    </span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <Button variant="outline" asChild>
                    <Link href="/signup/patient">
                      <User className="mr-2 h-4 w-4" />
                      Patient Sign Up
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/signup/doctor">
                      <Stethoscope className="mr-2 h-4 w-4" />
                      Doctor Sign Up
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
