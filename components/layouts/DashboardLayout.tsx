"use client"

import * as React from "react"
import { Navbar } from "./Navbar"
import { Sidebar } from "./Sidebar"
import { Breadcrumbs } from "./Breadcrumbs"

interface DashboardLayoutProps {
  children: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  showBreadcrumbs?: boolean
}

export function DashboardLayout({
  children,
  breadcrumbs,
  showBreadcrumbs = true,
}: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className="lg:pl-64">
        <div className="container-responsive py-6">
          {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} />}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  )
}

