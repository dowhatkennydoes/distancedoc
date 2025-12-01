"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Calendar,
  Building2,
  CreditCard,
  FileText,
  Shield,
  Flag,
  Activity,
  Search,
  Moon,
  Sun,
  Menu,
  X,
  ChevronRight,
  Settings,
  LogOut,
  User as UserIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/AuthContext"
import { AuthGuard } from "@/components/auth"
import { GlobalSearch, useGlobalSearch } from "@/components/admin/GlobalSearch"

interface AdminLayoutProps {
  children: React.ReactNode
  breadcrumbs?: Array<{ label: string; href?: string }>
  showBreadcrumbs?: boolean
}

interface NavItem {
  title: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  badge?: number
}

const adminNavItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "Doctors",
    href: "/admin/doctors",
    icon: Users,
  },
  {
    title: "Patients",
    href: "/admin/patients",
    icon: Users,
  },
  {
    title: "Appointments",
    href: "/admin/appointments",
    icon: Calendar,
  },
  {
    title: "Clinics",
    href: "/admin/clinics",
    icon: Building2,
  },
  {
    title: "Billing",
    href: "/admin/billing",
    icon: CreditCard,
  },
  {
    title: "Audit Logs",
    href: "/admin/audit-logs",
    icon: FileText,
  },
  {
    title: "Security",
    href: "/admin/security",
    icon: Shield,
  },
  {
    title: "Feature Flags",
    href: "/admin/feature-flags",
    icon: Flag,
  },
  {
    title: "System Health",
    href: "/admin/system-health",
    icon: Activity,
  },
]

function ThemeToggle() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light")
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem("theme") as "light" | "dark" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    document.documentElement.classList.toggle("dark", initialTheme === "dark")
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light"
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    document.documentElement.classList.toggle("dark", newTheme === "dark")
  }

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-5 w-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </Button>
  )
}

function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/admin") {
      return pathname === "/admin" || pathname === "/admin/"
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
              onClose()
            }
          }}
          role="button"
          tabIndex={-1}
          aria-label="Close sidebar"
        />
      )}

      {/* Sidebar */}
      <aside
        id="admin-sidebar"
        className={cn(
          "fixed left-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-64 border-r bg-background transition-transform duration-300 ease-in-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        aria-label="Admin navigation"
        aria-hidden={!isOpen}
      >
        <div className="flex h-full flex-col">
          {/* Mobile close button */}
          <div className="flex items-center justify-between border-b p-4 lg:hidden">
            <span className="font-semibold text-lg">Admin Menu</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4 overflow-y-auto" role="navigation" aria-label="Admin sidebar navigation">
            {adminNavItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.title}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold">
                      {item.badge}
                    </span>
                  )}
                  {active && (
                    <ChevronRight className="h-4 w-4 ml-auto" aria-hidden="true" />
                  )}
                </Link>
              )
            })}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium text-muted-foreground">Admin Panel</p>
              <p className="text-xs text-muted-foreground/80 mt-0.5">v1.0.0</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function AdminTopbar({
  isSidebarOpen,
  onMenuClick,
  breadcrumbs,
  showBreadcrumbs,
}: {
  isSidebarOpen: boolean
  onMenuClick: () => void
  breadcrumbs?: Array<{ label: string; href?: string }>
  showBreadcrumbs?: boolean
}) {
  const { user, signOut } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch()

  const getUserInitials = () => {
    if (!user?.email) return "A"
    return user.email.charAt(0).toUpperCase()
  }

  const handleSignOut = async () => {
    await signOut()
    router.push("/login")
  }

  const generateBreadcrumbs = () => {
    if (breadcrumbs) return breadcrumbs

    const paths = pathname?.split("/").filter(Boolean) || []
    const breadcrumbItems = [
      {
        label: "Admin",
        href: "/admin",
      },
    ]

    let currentPath = "/admin"
    paths.slice(1).forEach((path, index) => {
      currentPath += `/${path}`
      const isLast = index === paths.length - 2
      breadcrumbItems.push({
        label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " "),
        href: isLast ? undefined : currentPath,
      })
    })

    return breadcrumbItems
  }

  const breadcrumbItems = generateBreadcrumbs()

  return (
    <header
      className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      role="banner"
    >
      <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
        {/* Left side - Menu toggle and breadcrumbs */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9"
            onClick={onMenuClick}
            aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
            aria-expanded={isSidebarOpen}
            aria-controls="admin-sidebar"
          >
            {isSidebarOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>

          {/* Breadcrumbs - Desktop only (mobile shown in main content) */}
          {showBreadcrumbs && (
            <Breadcrumb className="hidden lg:flex">
              <BreadcrumbList>
                {breadcrumbItems.map((item, index) => {
                  const isLast = index === breadcrumbItems.length - 1
                  return (
                    <React.Fragment key={item.href || item.label}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage className="text-foreground font-medium">
                            {item.label}
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={item.href || "#"} className="hover:text-foreground">
                              {item.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast && <BreadcrumbSeparator />}
                    </React.Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </div>

        {/* Right side - Search, theme toggle, and user menu */}
        <div className="flex items-center gap-2">
          {/* Global Search Button */}
          <Button
            variant="outline"
            className="hidden md:flex items-center gap-2 h-9 px-3 text-muted-foreground"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="h-4 w-4" />
            <span className="hidden lg:inline">Search...</span>
            <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* Theme toggle */}
          <ThemeToggle />

          <Separator orientation="vertical" className="h-6" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-9 w-9 rounded-full focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Admin user menu"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user?.email ? undefined : undefined} alt={user?.email || "Admin"} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Admin</p>
                  <p className="text-xs leading-none text-muted-foreground truncate">
                    {user?.email || "admin@example.com"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="flex items-center cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/admin/settings" className="flex items-center cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

export function AdminLayout({
  children,
  breadcrumbs,
  showBreadcrumbs = true,
}: AdminLayoutProps) {
  const pathname = usePathname()
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false)
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch()

  const generateBreadcrumbs = () => {
    if (breadcrumbs) return breadcrumbs

    const paths = pathname?.split("/").filter(Boolean) || []
    const breadcrumbItems = [
      {
        label: "Admin",
        href: "/admin",
      },
    ]

    let currentPath = "/admin"
    paths.slice(1).forEach((path, index) => {
      currentPath += `/${path}`
      const isLast = index === paths.length - 2
      breadcrumbItems.push({
        label: path.charAt(0).toUpperCase() + path.slice(1).replace(/-/g, " "),
        href: isLast ? undefined : currentPath,
      })
    })

    return breadcrumbItems
  }

  const breadcrumbItems = generateBreadcrumbs()

  return (
    <AuthGuard requiredRole="admin">
      <div className="min-h-screen bg-background">
        <AdminTopbar
          isSidebarOpen={isSidebarOpen}
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          breadcrumbs={breadcrumbs}
          showBreadcrumbs={showBreadcrumbs}
        />
        <AdminSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main className="lg:pl-64 transition-all duration-300">
          <div className="container-responsive py-6">
            {/* Mobile breadcrumbs */}
            {showBreadcrumbs && (
              <div className="md:hidden mb-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    {breadcrumbItems.map((item, index) => {
                      const isLast = index === breadcrumbItems.length - 1
                      return (
                        <React.Fragment key={item.href || item.label}>
                          <BreadcrumbItem>
                            {isLast ? (
                              <BreadcrumbPage className="text-foreground font-medium">
                                {item.label}
                              </BreadcrumbPage>
                            ) : (
                              <BreadcrumbLink asChild>
                                <Link href={item.href || "#"} className="hover:text-foreground">
                                  {item.label}
                                </Link>
                              </BreadcrumbLink>
                            )}
                          </BreadcrumbItem>
                          {!isLast && <BreadcrumbSeparator />}
                        </React.Fragment>
                      )
                    })}
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            )}
            <div className="mt-6">{children}</div>
          </div>
        </main>
        {/* Global Search Modal */}
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </AuthGuard>
  )
}

