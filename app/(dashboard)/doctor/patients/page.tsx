"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { DoctorDashboardLayout } from "@/components/layouts"
import { DoctorPatientsSkeleton } from "@/components/ui/doctor-dashboard-skeletons"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import { Search, UserPlus, Filter } from "lucide-react"
import { format, differenceInYears, parseISO, isAfter, subDays } from "date-fns"
import { useToast } from "@/components/ui/use-toast"

type FilterType = "all" | "active" | "new" | "needing-follow-up"

interface Patient {
  id: string
  name: string
  email?: string
  dateOfBirth: string
  lastVisit?: string
  nextVisit?: string
  status: "active" | "new" | "needing-follow-up"
  createdAt: string
}

export default function PatientsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<FilterType>("all")

  useEffect(() => {
    const fetchPatients = async () => {
      if (!user || user.role !== "doctor") return

      try {
        // Fetch patients for this doctor
        const response = await fetch("/api/patients", {
          credentials: "include",
        })

        if (response.ok) {
          const data = await response.json()
          // Transform the data to include calculated fields
          const transformedPatients: Patient[] = (data.patients || []).map((patient: any) => {
            // Determine status
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
          // Fallback to empty array if API not implemented
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
  }, [user, authLoading, toast])

  const filteredPatients = useMemo(() => {
    let filtered = patients

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (patient) =>
          patient.name.toLowerCase().includes(query) ||
          patient.email?.toLowerCase().includes(query)
      )
    }

    // Apply status filter
    if (filter !== "all") {
      filtered = filtered.filter((patient) => {
        switch (filter) {
          case "active":
            return patient.status === "active"
          case "new":
            return patient.status === "new"
          case "needing-follow-up":
            return patient.status === "needing-follow-up"
          default:
            return true
        }
      })
    }

    return filtered
  }, [patients, searchQuery, filter])

  const calculateAge = (dateOfBirth: string) => {
    try {
      return differenceInYears(new Date(), parseISO(dateOfBirth))
    } catch {
      return "N/A"
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "—"
    try {
      return format(parseISO(dateString), "MMM d, yyyy")
    } catch {
      return "—"
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Active" },
      new: { variant: "secondary", label: "New" },
      "needing-follow-up": { variant: "destructive", label: "Needs Follow-up" },
    }

    const statusInfo = statusMap[status] || { variant: "outline" as const, label: status }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  const handleRowClick = (patientId: string) => {
    router.push(`/doctor/patients/${patientId}`)
  }

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <DoctorPatientsSkeleton />
      </DoctorDashboardLayout>
    )
  }

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
              {/* Search Bar */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={filter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("all")}
                >
                  All ({patients.length})
                </Button>
                <Button
                  variant={filter === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("active")}
                >
                  Active ({patients.filter((p) => p.status === "active").length})
                </Button>
                <Button
                  variant={filter === "new" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("new")}
                >
                  New ({patients.filter((p) => p.status === "new").length})
                </Button>
                <Button
                  variant={filter === "needing-follow-up" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter("needing-follow-up")}
                >
                  Needs Follow-up ({patients.filter((p) => p.status === "needing-follow-up").length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patients Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {filteredPatients.length} Patient{filteredPatients.length !== 1 ? "s" : ""}
            </CardTitle>
            <CardDescription>
              {filter !== "all" && `Filtered by: ${filter.replace("-", " ")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredPatients.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Age</TableHead>
                      <TableHead>Last Visit</TableHead>
                      <TableHead>Next Visit</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPatients.map((patient) => (
                      <TableRow
                        key={patient.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => handleRowClick(patient.id)}
                      >
                        <TableCell className="font-medium">
                          <div>
                            <div>{patient.name}</div>
                            {patient.email && (
                              <div className="text-sm text-muted-foreground">
                                {patient.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{calculateAge(patient.dateOfBirth)}</TableCell>
                        <TableCell>{formatDate(patient.lastVisit)}</TableCell>
                        <TableCell>{formatDate(patient.nextVisit)}</TableCell>
                        <TableCell>{getStatusBadge(patient.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <UserPlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-1">
                  {searchQuery || filter !== "all"
                    ? "No patients found"
                    : "No patients yet"}
                </p>
                <p className="text-sm mb-4">
                  {searchQuery || filter !== "all"
                    ? "Try adjusting your search or filter criteria"
                    : "Start by adding your first patient"}
                </p>
                {!searchQuery && filter === "all" && (
                  <Button variant="outline" asChild>
                    <a href="/doctor/patients/new">Add Patient</a>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DoctorDashboardLayout>
  )
}

