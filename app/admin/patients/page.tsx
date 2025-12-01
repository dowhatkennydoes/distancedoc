"use client"

import * as React from "react"
import { AdminLayout } from "@/components/admin/layout"
import { PatientProfileDrawer } from "@/components/admin/PatientProfileDrawer"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Search,
  MoreVertical,
  User,
  Eye,
  RefreshCw,
  AlertCircle,
  Calendar,
  Archive,
  Flag,
  UserCheck,
  ArrowRight,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { format, differenceInYears } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface Patient {
  id: string
  name: string
  firstName: string
  lastName: string
  dateOfBirth: string
  phone: string
  email: string
  assignedDoctor: string
  assignedDoctorId: string | null
  lastVisit: Date | null
  isAtRisk: boolean
  needsFollowUp: boolean
  allergies: any
  createdAt: string
}

export default function AdminPatientsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [patients, setPatients] = React.useState<Patient[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [filter, setFilter] = React.useState<string>("all")
  const [selectedPatientId, setSelectedPatientId] = React.useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [actionDialog, setActionDialog] = React.useState<{
    open: boolean
    action: string | null
    patient: Patient | null
    doctorId?: string
    followUpDate?: string
  }>({
    open: false,
    action: null,
    patient: null,
  })
  const [doctors, setDoctors] = React.useState<
    Array<{ id: string; name: string; specialization: string }>
  >([])
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })

  const fetchPatients = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })

      if (searchQuery) {
        params.append("search", searchQuery)
      }
      if (filter !== "all") {
        params.append("filter", filter)
      }

      const response = await fetch(`/api/admin/patients?${params.toString()}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setPatients(data.patients || [])
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }))
      }
    } catch (error) {
      console.error("Failed to fetch patients:", error)
      toast({
        title: "Error",
        description: "Failed to fetch patients. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, searchQuery, filter, pagination.page, pagination.limit, toast])

  const fetchDoctors = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    try {
      const response = await fetch("/api/admin/doctors?limit=100", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setDoctors(
          (data.doctors || []).map((d: any) => ({
            id: d.id,
            name: d.name,
            specialization: d.specialization,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error)
    }
  }, [user])

  React.useEffect(() => {
    fetchPatients()
    fetchDoctors()
  }, [fetchPatients, fetchDoctors])

  const handleAction = async (
    action: string,
    patient: Patient,
    additionalData?: { doctorId?: string; followUpDate?: string }
  ) => {
    try {
      const response = await fetch(`/api/admin/patients/${patient.id}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action,
          patientId: patient.id,
          ...additionalData,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        toast({
          title: "Success",
          description: data.message || `Patient ${action} successfully`,
        })
        fetchPatients() // Refresh list
        setActionDialog({ open: false, action: null, patient: null })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to perform action")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to perform action",
        variant: "destructive",
      })
    }
  }

  const handleViewProfile = (patientId: string) => {
    setSelectedPatientId(patientId)
    setIsDrawerOpen(true)
  }

  const openActionDialog = (action: string, patient: Patient) => {
    if (action === "reassign" || action === "mark_follow_up") {
      setActionDialog({
        open: true,
        action,
        patient,
        doctorId: patient.assignedDoctorId || undefined,
        followUpDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0], // Default to 7 days from now
      })
    } else {
      handleAction(action, patient)
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Patient Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage patients, assignments, and care coordination
          </p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>
              Search by name, email, or phone. Filter by status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Patients</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="at-risk">At-Risk</SelectItem>
                  <SelectItem value="follow-up">Requires Follow-up</SelectItem>
                  <SelectItem value="recent">Recently Added</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setFilter("all")
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Patients Table */}
        <Card>
          <CardHeader>
            <CardTitle>Patients ({pagination.total})</CardTitle>
            <CardDescription>
              Showing {patients.length} of {pagination.total} patients
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-muted-foreground">Loading patients...</div>
              </div>
            ) : patients.length === 0 ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <p className="text-muted-foreground">No patients found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your search or filters
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Date of Birth</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Assigned Doctor</TableHead>
                      <TableHead>Last Visit</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((patient) => (
                      <TableRow key={patient.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {patient.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(patient.dateOfBirth), "MMM d, yyyy")} (
                          {differenceInYears(new Date(), new Date(patient.dateOfBirth))}y)
                        </TableCell>
                        <TableCell>{patient.phone}</TableCell>
                        <TableCell>
                          {patient.assignedDoctor || (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {patient.lastVisit
                            ? format(new Date(patient.lastVisit), "MMM d, yyyy")
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {patient.isAtRisk && (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                At-Risk
                              </Badge>
                            )}
                            {patient.needsFollowUp && (
                              <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600">
                                <Flag className="h-3 w-3 mr-1" />
                                Follow-up
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleViewProfile(patient.id)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openActionDialog("reassign", patient)}
                              >
                                <UserCheck className="h-4 w-4 mr-2" />
                                Reassign to Doctor
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openActionDialog("mark_follow_up", patient)}
                              >
                                <Flag className="h-4 w-4 mr-2" />
                                Mark Follow-up Needed
                              </DropdownMenuItem>
                              {patient.needsFollowUp && (
                                <DropdownMenuItem
                                  onClick={() => handleAction("remove_follow_up", patient)}
                                >
                                  <Flag className="h-4 w-4 mr-2" />
                                  Remove Follow-up Flag
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => openActionDialog("archive", patient)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Archive className="h-4 w-4 mr-2" />
                                Archive Patient
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.page} of {pagination.totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(prev.totalPages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Patient Profile Drawer */}
      <PatientProfileDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedPatientId(null)
        }}
        patientId={selectedPatientId}
      />

      {/* Reassign Dialog */}
      <Dialog
        open={actionDialog.open && actionDialog.action === "reassign"}
        onOpenChange={(open) =>
          setActionDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reassign Patient</DialogTitle>
            <DialogDescription>
              Reassign {actionDialog.patient?.name} to a different doctor
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doctor">Select Doctor</Label>
              <Select
                value={actionDialog.doctorId || ""}
                onValueChange={(value) =>
                  setActionDialog((prev) => ({ ...prev, doctorId: value }))
                }
              >
                <SelectTrigger id="doctor" className="mt-2">
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.name} ({doctor.specialization})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog({ open: false, action: null, patient: null })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.patient && actionDialog.doctorId) {
                  handleAction("reassign", actionDialog.patient, {
                    doctorId: actionDialog.doctorId,
                  })
                }
              }}
              disabled={!actionDialog.doctorId}
            >
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Follow-up Dialog */}
      <Dialog
        open={actionDialog.open && actionDialog.action === "mark_follow_up"}
        onOpenChange={(open) =>
          setActionDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Follow-up Needed</DialogTitle>
            <DialogDescription>
              Set a follow-up date for {actionDialog.patient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="followUpDate">Follow-up Date</Label>
              <Input
                id="followUpDate"
                type="date"
                value={actionDialog.followUpDate || ""}
                onChange={(e) =>
                  setActionDialog((prev) => ({
                    ...prev,
                    followUpDate: e.target.value,
                  }))
                }
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog({ open: false, action: null, patient: null })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.patient && actionDialog.followUpDate) {
                  handleAction("mark_follow_up", actionDialog.patient, {
                    followUpDate: actionDialog.followUpDate,
                  })
                }
              }}
              disabled={!actionDialog.followUpDate}
            >
              Mark Follow-up
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

