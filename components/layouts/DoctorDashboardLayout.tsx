"use client"

import * as React from "react"
import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"
import { Breadcrumbs } from "./Breadcrumbs"
import { AuthGuard } from "@/components/auth"

interface DoctorDashboardLayoutProps {
  children: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  showBreadcrumbs?: boolean
}

export function DoctorDashboardLayout({
  children,
  breadcrumbs,
  showBreadcrumbs = true,
}: DoctorDashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  return (
    <AuthGuard requiredRole="doctor" requireApproval>
      <div className="min-h-screen bg-background">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
        />
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="lg:pl-64 transition-all duration-300">
          <div className="container-responsive py-6">
            {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} />}
            <div className="mt-6">{children}</div>
          </div>
        </main>
      </div>
    </AuthGuard>
  )
}

