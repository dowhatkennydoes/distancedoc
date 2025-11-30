"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  FileText,
  Calendar,
  MessageSquare,
  CreditCard,
  Settings,
  Stethoscope,
  User,
  X,
  ClipboardList,
  FlaskConical,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles?: ("doctor" | "patient" | "admin")[]
}

const doctorNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["doctor", "admin"],
  },
  {
    title: "Appointments",
    href: "/doctor/appointments",
    icon: Calendar,
    roles: ["doctor", "admin"],
  },
  {
    title: "Patients",
    href: "/doctor/patients",
    icon: Users,
    roles: ["doctor", "admin"],
  },
  {
    title: "Messages",
    href: "/doctor/messages",
    icon: MessageSquare,
    roles: ["doctor", "admin"],
  },
  {
    title: "Visit Notes",
    href: "/doctor/visit-notes",
    icon: ClipboardList,
    roles: ["doctor", "admin"],
  },
  {
    title: "Labs",
    href: "/doctor/labs",
    icon: FlaskConical,
    roles: ["doctor", "admin"],
  },
  {
    title: "Billing",
    href: "/doctor/billing",
    icon: Receipt,
    roles: ["doctor", "admin"],
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    roles: ["doctor", "admin"],
  },
]

const patientNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/patient",
    icon: LayoutDashboard,
    roles: ["patient"],
  },
  {
    title: "Visits",
    href: "/patient/visits",
    icon: Calendar,
    roles: ["patient"],
  },
  {
    title: "Forms",
    href: "/patient/forms",
    icon: FileText,
    roles: ["patient"],
  },
  {
    title: "Messages",
    href: "/patient/messages",
    icon: MessageSquare,
    roles: ["patient"],
  },
  {
    title: "Files",
    href: "/patient/files",
    icon: FileText,
    roles: ["patient"],
  },
  {
    title: "Summaries",
    href: "/patient/summaries",
    icon: FileText,
    roles: ["patient"],
  },
  {
    title: "Payments",
    href: "/patient/payments",
    icon: CreditCard,
    roles: ["patient"],
  },
]

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { user } = useAuth()

  const getNavItems = (): NavItem[] => {
    if (!user) return []
    if (user.role === "doctor" || user.role === "admin") {
      return doctorNavItems
    }
    if (user.role === "patient") {
      return patientNavItems
    }
    return []
  }

  const navItems = getNavItems()

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/patient") {
      return pathname === href
    }
    return pathname?.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              onClose?.()
            }
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        id="sidebar"
        className={cn(
          "fixed left-0 top-14 sm:top-16 z-50 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-64 border-r bg-background transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col">
          {/* Mobile close button */}
          <div className="flex items-center justify-between border-b p-3 sm:p-4 lg:hidden">
            <span className="font-semibold text-sm sm:text-base">Menu</span>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px]"
              aria-label="Close sidebar"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-3 sm:p-4 overflow-y-auto" role="navigation" aria-label="Sidebar navigation">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:min-h-[40px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span>{item.title}</span>
                </Link>
              )
            })}
          </nav>

          {/* Bottom section - Only show for patients */}
          {user?.role === "patient" && (
            <div className="border-t p-3 sm:p-4">
              <Link
                href="/settings"
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors min-h-[44px] sm:min-h-[40px]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  pathname === "/settings"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                aria-current={pathname === "/settings" ? "page" : undefined}
              >
                <Settings className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <span>Settings</span>
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

