"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { PageSkeleton } from "@/components/ui/loading-skeletons"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: "doctor" | "patient" | "admin"
  requireApproval?: boolean
  redirectTo?: string
}

export function AuthGuard({
  children,
  requiredRole,
  requireApproval = false,
  redirectTo,
}: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted || loading) return

    // Check if user is authenticated
    if (!user) {
      router.push(redirectTo || "/login")
      return
    }

    // Check role requirement
    if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
      router.push(redirectTo || "/dashboard")
      return
    }

    // Check approval requirement
    if (requireApproval && !user.metadata?.approved) {
      router.push(redirectTo || "/doctor/pending")
      return
    }
  }, [user, loading, mounted, requiredRole, requireApproval, redirectTo, router])

  if (!mounted || loading) {
    return <PageSkeleton />
  }

  if (!user) {
    return null
  }

  if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
    return null
  }

  if (requireApproval && !user.metadata?.approved) {
    return null
  }

  return <>{children}</>
}

