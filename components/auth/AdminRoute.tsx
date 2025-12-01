"use client"

/**
 * AdminRoute Component - Client-Side Admin Route Protection
 * 
 * Features:
 * - Redirects unauthenticated users to /login
 * - Redirects authenticated non-admin users to their dashboard
 * - Full-screen loader during auth hydration
 * - Console warnings for dev environment only
 * - Hydration-safe
 * 
 * Requirements:
 * 1. If authenticated is false → redirect to /login
 * 2. If authenticated but role is not admin → redirect to correct dashboard
 * 3. Full-screen loader while auth is hydrating
 * 4. Console warnings for dev environment only
 */

import * as React from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Loader2 } from "lucide-react"

interface AdminRouteProps {
  children: React.ReactNode
  redirectTo?: string // Optional custom redirect destination
}

/**
 * Full-screen loader component for admin routes
 */
function AdminRouteLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Verifying admin access...</p>
      </div>
    </div>
  )
}

/**
 * Get dashboard URL based on user role
 */
function getDashboardForRole(role: string): string {
  switch (role) {
    case "doctor":
      return "/dashboard"
    case "patient":
      return "/patient"
    case "admin":
      return "/admin/dashboard"
    default:
      return "/dashboard"
  }
}

/**
 * Check if running in development environment
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}

export function AdminRoute({ children, redirectTo }: AdminRouteProps) {
  const { user, authenticated, loading, authReady } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = React.useState(false)
  const [hasRedirected, setHasRedirected] = React.useState(false)

  // Track mounted state for hydration safety
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Requirement 1 & 2: Handle redirects based on authentication and role
  React.useEffect(() => {
    if (!mounted || !authReady || loading || hasRedirected) {
      return
    }

    // Requirement 1: If authenticated is false → redirect to /login
    if (!authenticated || !user) {
      if (isDevelopment()) {
        console.warn(
          "[AdminRoute] Unauthenticated access attempt:",
          {
            pathname,
            authenticated,
            hasUser: !!user,
          }
        )
      }

      setHasRedirected(true)
      router.push(redirectTo || "/login")
      return
    }

    // Requirement 2: If authenticated but role is not admin → redirect to correct dashboard
    if (user.role !== "admin") {
      const dashboardUrl = getDashboardForRole(user.role)

      if (isDevelopment()) {
        console.warn(
          "[AdminRoute] Non-admin access attempt:",
          {
            pathname,
            userRole: user.role,
            userEmail: user.email,
            redirectingTo: dashboardUrl,
          }
        )
      }

      setHasRedirected(true)
      router.push(redirectTo || dashboardUrl)
      return
    }

    // User is authenticated and is admin - log success in dev
    if (isDevelopment() && user.role === "admin") {
      console.log(
        "[AdminRoute] Admin access granted:",
        {
          pathname,
          userEmail: user.email,
          userId: user.id,
        }
      )
    }
  }, [
    mounted,
    authReady,
    loading,
    authenticated,
    user,
    router,
    pathname,
    redirectTo,
    hasRedirected,
  ])

  // Requirement 3: Show full-screen loader while auth is hydrating
  if (!mounted || !authReady || loading) {
    return <AdminRouteLoader />
  }

  // Requirement 1: If not authenticated, show loader (will redirect)
  if (!authenticated || !user) {
    return <AdminRouteLoader />
  }

  // Requirement 2: If not admin, show loader (will redirect)
  if (user.role !== "admin") {
    return <AdminRouteLoader />
  }

  // User is authenticated and is admin - render children
  return <>{children}</>
}

