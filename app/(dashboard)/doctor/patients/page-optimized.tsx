/**
 * OPTIMIZED Patient List Page
 * 
 * Optimizations:
 * - React.memo for PatientRow component
 * - useCallback for all handlers
 * - Zustand store for state management
 * - Pagination (50 items per page)
 * - Suspense boundaries
 * - Skeleton UI during loading
 * - Reduced re-renders
 */

"use client"

import { Suspense, memo, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorPatientsSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PaginatedTable } from "@/components/ui/PaginatedTable"
import { useAuth } from "@/contexts/AuthContext"
import { usePatientStore } from "@/lib/stores/patient-store"
import { Search, UserPlus, Filter } from "lucide-react"
import { format, differenceInYears, parseISO, isAfter, subDays } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import { useEffect } from "react"

// Memoized PatientRow component to prevent unnecessary re-renders
const PatientRow = memo(({ 
  patient, 
  onRowClick 
}: { 
  patient: { 
    id: string
    name: string
    email?: string
    dateOfBirth: string
    lastVisit?: string
    nextVisit?: string
    status: string
  }
  onRowClick: (id: string) => void
}) => {
  const calculateAge = useCallback((dateOfBirth: string) => {
    try {
      return differenceInYears(new Date(), parseISO(dateOfBirth))
    } catch {
      return "N/A"
    }
  }, [])

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return "—"
    try {
      return format(parseISO(dateString), "MMM d, yyyy")
    } catch {
      return "—"
    }
  }, [])

  const getStatusBadge = useCallback((status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Active" },
      new: { variant: "secondary", label: "New" },
      "needing-follow-up": { variant: "destructive", label: "Needs Follow-up" },
    }

    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }, [])

  return (
    <>
      <td className="font-medium">
        <div>
          <div>{patient.name}</div>
          {patient.email && (
            <div className="text-sm text-muted-foreground">
              {patient.email}
            </div>
          )}
        </div>
      </td>
      <td>{calculateAge(patient.dateOfBirth)}</td>
      <td>{formatDate(patient.lastVisit)}</td>
      <td>{formatDate(patient.nextVisit)}</td>
      <td>{getStatusBadge(patient.status)}</td>
    </>
  )
})

PatientRow.displayName = 'PatientRow'

// Main component with Suspense boundary
function PatientsPageContent() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  
  // Zustand store hooks
  const {
    patients,
    searchQuery,
    filter,
    page,
    loading,
    setPatients,
    setSearchQuery,
    setFilter,
    setPage,
    setLoading,
    getPaginatedPatients,
    getTotalPages,
  } = usePatientStore()

  // Fetch patients
  useEffect(() => {
    const fetchPatients = async () => {
      if (!user || user.role !== "doctor") return

      try {
        setLoading(true)
        const response = await fetch("/api/patients", {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          const transformedPatients = (data.patients || []).map((patient: any) => {
            let status: "active" | "new" | "needing-follow-up" = "active"
            const createdAt = parseISO(patient.createdAt)
            const thirtyDaysAgo = subDays(new Date(), 30)
            
            if (isAfter(createdAt, thirtyDaysAgo)) {
              status = "new"
            } else if (patient.lastVisit) {
              const lastVisitDate = parseISO(patient.lastVisit)
              const daysSinceLastVisit = Math.floor(
                (new Date().getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
              )
              
              if (daysSinceLastVisit > 90) {
                status = "needing-follow-up"
              }
            } else {
              status = "needing-follow-up"
            }

            return {
              id: patient.id,
              name: patient.name || `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
              email: patient.email,
              dateOfBirth: patient.dateOfBirth,
              lastVisit: patient.lastVisit,
              nextVisit: patient.nextVisit,
              status,
              createdAt: patient.createdAt,
            }
          })

          setPatients(transformedPatients)
        } else {
          setPatients([])
        }
      } catch (error) {
        console.error("Error fetching patients:", error)
        setPatients([])
        toast({
          title: "Error",
          description: "Failed to load patients. Please try again.",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading && user) {
      fetchPatients()
    }
  }, [user, authLoading, setPatients, setLoading, toast])

  // Memoized handlers
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [setSearchQuery])

  const handleFilterChange = useCallback((newFilter: "all" | "active" | "new" | "needing-follow-up") => {
    setFilter(newFilter)
  }, [setFilter])

  const handleRowClick = useCallback((patient: { id: string }) => {
    router.push(`/doctor/patients/${patient.id}`)
  }, [router])

  // Memoized table columns
  const columns = useMemo(() => [
    {
      key: "name",
      header: "Name",
      render: (patient: any) => (
        <div>
          <div className="font-medium">{patient.name}</div>
          {patient.email && (
            <div className="text-sm text-muted-foreground">{patient.email}</div>
          )}
        </div>
      ),
    },
    {
      key: "age",
      header: "Age",
      render: (patient: any) => {
        try {
          return differenceInYears(new Date(), parseISO(patient.dateOfBirth))
        } catch {
          return "N/A"
        }
      },
    },
    {
      key: "lastVisit",
      header: "Last Visit",
      render: (patient: any) => {
        if (!patient.lastVisit) return "—"
        try {
          return format(parseISO(patient.lastVisit), "MMM d, yyyy")
        } catch {
          return "—"
        }
      },
    },
    {
      key: "nextVisit",
      header: "Next Visit",
      render: (patient: any) => {
        if (!patient.nextVisit) return "—"
        try {
          return format(parseISO(patient.nextVisit), "MMM d, yyyy")
        } catch {
          return "—"
        }
      },
    },
    {
      key: "status",
      header: "Status",
      render: (patient: any) => {
        const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
          active: { variant: "default", label: "Active" },
          new: { variant: "secondary", label: "New" },
          "needing-follow-up": { variant: "destructive", label: "Needs Follow-up" },
        }
        const statusInfo = statusMap[patient.status] || { variant: "outline" as const, label: patient.status }
        return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
      },
    },
  ], [])

  // Get filter counts (memoized)
  const filterCounts = useMemo(() => {
    const all = patients.length
    const active = patients.filter((p) => p.status === "active").length
    const newCount = patients.filter((p) => p.status === "new").length
    const needingFollowUp = patients.filter((p) => p.status === "needing-follow-up").length
    return { all, active, new: newCount, "needing-follow-up": needingFollowUp }
  }, [patients])

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <DoctorPatientsSkeleton />
      </DoctorDashboardLayout>
    )
  }

  const paginatedPatients = getPaginatedPatients()

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Patients</h1>
            <p className="text-muted-foreground mt-2">
              Manage your patient roster and view patient information
            </p>
          </div>
          <Button asChild>
            <a href="/doctor/patients/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Patient
            </a>
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find patients by name or email</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange("all")}
                >
                  All ({filterCounts.all})
                </Button>
                <Button
                  variant={filter === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange("active")}
                >
                  Active ({filterCounts.active})
                </Button>
                <Button
                  variant={filter === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange("new")}
                >
                  New ({filterCounts.new})
                </Button>
                <Button
                  variant={filter === "needing-follow-up" ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFilterChange("needing-follow-up")}
                >
                  Needs Follow-up ({filterCounts["needing-follow-up"]})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patients Table with Pagination */}
        <Card>
          <CardHeader>
            <CardTitle>
              {paginatedPatients.length} Patient{paginatedPatients.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              {filter !== "all" && `Filtered by: ${filter.replace("-", " ")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<DoctorPatientsSkeleton />}>
              <PaginatedTable
                data={paginatedPatients}
                columns={columns}
                pageSize={50}
                currentPage={page}
                onPageChange={setPage}
                emptyMessage="No patients found"
                onRowClick={handleRowClick}
                loading={loading}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </DoctorDashboardLayout>
  )
}

// Wrap with Suspense boundary
export default function PatientsPage() {
  return (
    <Suspense fallback={
      <DoctorDashboardLayout>
        <DoctorPatientsSkeleton />
      </DoctorDashboardLayout>
    }>
      <PatientsPageContent />
    </Suspense>
  )
}

