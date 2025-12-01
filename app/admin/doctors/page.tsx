"use client"

import * as React from "react"
import { AdminLayout } from "@/components/admin/layout"
import { DoctorProfileDrawer } from "@/components/admin/DoctorProfileDrawer"
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
  CheckCircle,
  XCircle,
  Ban,
  Key,
  Eye,
  Shield,
  UserCog,
  RefreshCw,
  AlertCircle,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { format } from "date-fns"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Doctor {
  id: string
  userId: string
  email: string
  name: string
  specialization: string
  licenseNumber: string
  npiNumber: string
  status: "active" | "suspended" | "pending"
  clinicId: string
  credentials: string[]
  createdAt: string
  approved: boolean
}

export default function AdminDoctorsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [doctors, setDoctors] = React.useState<Doctor[]>([])
  const [searchQuery, setSearchQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [selectedDoctorId, setSelectedDoctorId] = React.useState<string | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false)
  const [actionDialog, setActionDialog] = React.useState<{
    open: boolean
    action: string | null
    doctor: Doctor | null
    resetLink?: string
  }>({
    open: false,
    action: null,
    doctor: null,
  })
  const [pagination, setPagination] = React.useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 0,
  })

  const fetchDoctors = React.useCallback(async () => {
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
      if (statusFilter !== "all") {
        params.append("status", statusFilter)
      }

      const response = await fetch(`/api/admin/doctors?${params.toString()}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setDoctors(data.doctors || [])
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }))
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error)
      toast({
        title: "Error",
        description: "Failed to fetch doctors. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, searchQuery, statusFilter, pagination.page, pagination.limit, toast])

  React.useEffect(() => {
    fetchDoctors()
  }, [fetchDoctors])

  const handleAction = async (action: string, doctor: Doctor) => {
    try {
      const response = await fetch(`/api/admin/doctors/${doctor.id}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          action,
          doctorId: doctor.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()

        if (action === "reset_password" && data.resetLink) {
          setActionDialog({
            open: true,
            action: "reset_password",
            doctor,
            resetLink: data.resetLink,
          })
        } else {
          toast({
            title: "Success",
            description: data.message || `Doctor ${action}d successfully`,
          })
          fetchDoctors() // Refresh list
        }
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

  const handleViewProfile = (doctorId: string) => {
    setSelectedDoctorId(doctorId)
    setIsDrawerOpen(true)
  }

  const handleViewAudit = async (doctorId: string) => {
    try {
      const response = await fetch(`/api/admin/doctors/${doctorId}/audit`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        // TODO: Show audit events in a dialog or drawer
        toast({
          title: "Audit Events",
          description: `Found ${data.total} audit events for this doctor`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch audit events",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string, approved: boolean) => {
    if (!approved) {
      return (
        <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
          <AlertCircle className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      )
    }
    if (status === "suspended") {
      return (
        <Badge variant="destructive">
          <Ban className="h-3 w-3 mr-1" />
          Suspended
        </Badge>
      )
    }
    return (
      <Badge variant="default" className="bg-green-500/10 text-green-600">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    )
  }

  // Doctors are already filtered by the API
  const filteredDoctors = doctors

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Doctor Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage doctors, approvals, and access
          </p>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>
              Search by name, specialty, or email. Filter by status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search by name, specialty, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("all")
                }}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Doctors Table */}
        <Card>
          <CardHeader>
            <CardTitle>Doctors ({pagination.total})</CardTitle>
            <CardDescription>
              Showing {filteredDoctors.length} of {pagination.total} doctors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-muted-foreground">Loading doctors...</div>
              </div>
            ) : filteredDoctors.length === 0 ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <p className="text-muted-foreground">No doctors found</p>
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
                      <TableHead>Email</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Clinic</TableHead>
                      <TableHead>Date Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDoctors.map((doctor) => (
                      <TableRow key={doctor.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {doctor.name}
                          </div>
                        </TableCell>
                        <TableCell>{doctor.email}</TableCell>
                        <TableCell>
                          {doctor.specialization || "Not specified"}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(doctor.status, doctor.approved)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doctor.clinicId}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(doctor.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleViewProfile(doctor.id)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {!doctor.approved && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction("approve", doctor)
                                    }
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve Doctor
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction("reject", doctor)
                                    }
                                  >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject Doctor
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              {doctor.approved && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleAction("suspend", doctor)
                                  }
                                >
                                  <Ban className="h-4 w-4 mr-2" />
                                  Suspend Account
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() =>
                                  handleAction("reset_password", doctor)
                                }
                              >
                                <Key className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleViewAudit(doctor.id)}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                View Audit Events
                              </DropdownMenuItem>
                              {process.env.NODE_ENV !== "production" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleAction("impersonate", doctor)
                                    }
                                    className="text-orange-600"
                                  >
                                    <UserCog className="h-4 w-4 mr-2" />
                                    Impersonate (Dev Only)
                                  </DropdownMenuItem>
                                </>
                              )}
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

      {/* Doctor Profile Drawer */}
      <DoctorProfileDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false)
          setSelectedDoctorId(null)
        }}
        doctorId={selectedDoctorId}
      />

      {/* Action Confirmation Dialogs */}
      <Dialog
        open={actionDialog.open && actionDialog.action === "reset_password"}
        onOpenChange={(open) =>
          setActionDialog((prev) => ({ ...prev, open }))
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password Reset Link</DialogTitle>
            <DialogDescription>
              Password reset link generated for {actionDialog.doctor?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-2">Reset Link:</p>
              <div className="p-3 bg-muted rounded-md break-all text-sm">
                {actionDialog.resetLink}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Copy this link and send it to the doctor. The link will expire
              after use.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setActionDialog({ open: false, action: null, doctor: null })
              }
            >
              Close
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.resetLink) {
                  navigator.clipboard.writeText(actionDialog.resetLink)
                  toast({
                    title: "Copied",
                    description: "Reset link copied to clipboard",
                  })
                }
              }}
            >
              Copy Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

