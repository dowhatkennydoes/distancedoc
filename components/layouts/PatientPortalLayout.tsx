"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Calendar,
  FileText,
  MessageSquare,
  FileCheck,
  CreditCard,
  Folder,
  Menu,
  X,
  LogOut,
  User,
  Settings,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { AuthGuard } from "@/components/auth"

interface PatientPortalLayoutProps {
  children: React.ReactNode
}

const navigationItems = [
  {
    title: "Appointments",
    href: "/patient/visits",
    icon: Calendar,
  },
  {
    title: "Intake Forms",
    href: "/patient/forms",
    icon: FileText,
  },
  {
    title: "Messages",
    href: "/patient/messages",
    icon: MessageSquare,
  },
  {
    title: "Visit Summaries",
    href: "/patient/summaries",
    icon: FileCheck,
  },
  {
    title: "Billing",
    href: "/patient/payments",
    icon: CreditCard,
  },
  {
    title: "Files",
    href: "/patient/files",
    icon: Folder,
  },
]

export function PatientPortalLayout({ children }: PatientPortalLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const getInitials = (name?: string) => {
    if (!name) return "P"
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const patientName = user?.firstName && user?.lastName
    ? `${user.firstName} ${user.lastName}`
    : user?.email || "Patient"

  return (
    <AuthGuard requiredRole="patient">
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30">
        {/* Top Navigation */}
        <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-sm shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 lg:px-6">
            {/* Logo and Mobile Menu */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
              <Link href="/patient" className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 text-white">
                  <span className="text-sm font-bold">DD</span>
                </div>
                <span className="hidden sm:block text-xl font-semibold text-gray-900">
                  DistanceDoc
                </span>
              </Link>
            </div>

            {/* Right Side - Patient Info & Actions */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500"></span>
              </Button>

              {/* Patient Profile Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-2 h-auto py-2 px-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white text-sm">
                        {getInitials(patientName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:block text-left">
                      <div className="text-sm font-medium text-gray-900">{patientName}</div>
                      <div className="text-xs text-muted-foreground">Patient</div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{patientName}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/patient" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/patient/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside
            className={cn(
              "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r shadow-sm transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            )}
          >
            <div className="flex h-full flex-col">
              {/* Sidebar Header */}
              <div className="flex h-16 items-center border-b px-6">
                <h2 className="text-lg font-semibold text-gray-900">Navigation</h2>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 space-y-1 p-4">
                {navigationItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                        isActive
                          ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm"
                          : "text-gray-700 hover:bg-blue-50/50 hover:text-blue-600"
                      )}
                    >
                      <Icon className={cn(
                        "h-5 w-5",
                        isActive ? "text-blue-600" : "text-gray-500"
                      )} />
                      <span>{item.title}</span>
                    </Link>
                  )
                })}
              </nav>

              {/* Sidebar Footer */}
              <div className="border-t p-4">
                <div className="rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 p-4">
                  <p className="text-xs font-medium text-blue-900">Need Help?</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Contact support for assistance
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* Overlay for mobile */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/50 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="container-responsive py-6 px-4 lg:px-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </AuthGuard>
  )
}

