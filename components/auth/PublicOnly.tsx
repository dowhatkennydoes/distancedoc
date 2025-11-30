"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { PageSkeleton } from "@/components/ui/loading-skeletons"

interface PublicOnlyProps {
  children: React.ReactNode
  redirectTo?: string
}

export function PublicOnly({ children, redirectTo }: PublicOnlyProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!mounted || loading) return

    if (user) {
      // Redirect based on user role
      const defaultRedirect =
        user.role === "doctor" || user.role === "admin"
          ? "/dashboard"
          : "/patient"
      router.push(redirectTo || defaultRedirect)
    }
  }, [user, loading, mounted, redirectTo, router])

  if (!mounted || loading) {
    return <PageSkeleton />
  }

  if (user) {
    return null
  }

  return <>{children}</>
}

