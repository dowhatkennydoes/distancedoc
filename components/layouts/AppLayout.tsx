"use client"

import * as React from "react"
import { Navbar } from "./Navbar"
import { Breadcrumbs } from "./Breadcrumbs"

interface AppLayoutProps {
  children: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  showBreadcrumbs?: boolean
}

export function AppLayout({
  children,
  breadcrumbs,
  showBreadcrumbs = true,
}: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        isSidebarOpen={isSidebarOpen}
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
      />
      <main className="container-responsive py-6">
        {showBreadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  )
}

