"use client"

/**
 * Enhanced Auth Guard Component
 * 
 * Features:
 * - Role-based access control
 * - Doctor/patient route separation
 * - Approval status checking
 * - Automatic redirects
 * - Hydration-safe
 */

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { PageSkeleton } from "@/components/ui/loading-skeletons"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: "doctor" | "patient" | "admin"
  requireApproval?: boolean
  redirectTo?: string
  // Prevent cross-role access
  preventCrossRoleAccess?: boolean
}

export function AuthGuard({
  children,
  requiredRole,
  requireApproval = false,
  redirectTo,
  preventCrossRoleAccess = true,
}: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
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

    // Enhanced role checking with cross-role prevention
    if (requiredRole) {
      // Strict role matching (admin can access anything)
      if (user.role !== requiredRole && user.role !== "admin") {
        // Prevent cross-role access
        if (preventCrossRoleAccess) {
          // If patient trying to access doctor route, redirect to patient portal
          if (user.role === "patient" && requiredRole === "doctor") {
            router.push("/patient")
            return
          }
          // If doctor trying to access patient route, redirect to doctor dashboard
          if (user.role === "doctor" && requiredRole === "patient") {
            router.push("/dashboard")
            return
          }
        }
        
        router.push(redirectTo || "/dashboard")
        return
      }
    }

    // Check approval requirement (for doctors)
    if (requireApproval && user.role === "doctor" && !user.metadata?.approved) {
      router.push(redirectTo || "/doctor/pending")
      return
    }

    // Additional protection: Check pathname for role mismatches
    if (preventCrossRoleAccess && pathname) {
      // Patient accessing doctor routes
      if (user.role === "patient" && pathname.startsWith("/doctor")) {
        router.push("/patient")
        return
      }
      
      // Doctor accessing patient routes
      if (user.role === "doctor" && pathname.startsWith("/patient")) {
        router.push("/dashboard")
        return
      }
    }
  }, [user, loading, mounted, requiredRole, requireApproval, redirectTo, router, pathname, preventCrossRoleAccess])

  if (!mounted || loading) {
    return <PageSkeleton />
  }

  if (!user) {
    return null
  }

  if (requiredRole && user.role !== requiredRole && user.role !== "admin") {
    return null
  }

  if (requireApproval && user.role === "doctor" && !user.metadata?.approved) {
    return null
  }

  return <>{children}</>
}

