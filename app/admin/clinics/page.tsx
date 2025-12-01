"use client"

import * as React from "react"
import { AdminLayout } from "@/components/admin/layout"
import { ClinicSettingsDrawer } from "@/components/admin/ClinicSettingsDrawer"
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
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  MoreVertical,
  Settings,
  Users,
  Stethoscope,
  Calendar,
  Plus,
  Edit,
  Eye,
  Building2,
  RefreshCw,
  UserPlus,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Clinic {
  id: string
  name: string
  totalPatients: number
  totalDoctors: number
  monthlyVisits: number
  monthlyAppointments: number
}

export default function AdminClinicsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [clinics, setClinics] = React.useState<Clinic[]>([])
  const [selectedClinicId, setSelectedClinicId] = React.useState<string | null>(null)
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = React.useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false)
  const [isAssignDoctorDialogOpen, setIsAssignDoctorDialogOpen] = React.useState(false)
  const [editingClinic, setEditingClinic] = React.useState<Clinic | null>(null)
  const [assigningClinicId, setAssigningClinicId] = React.useState<string | null>(null)
  const [doctors, setDoctors] = React.useState<
    Array<{ id: string; name: string; specialization: string; clinicId: string }>
  >([])
  const [availableDoctors, setAvailableDoctors] = React.useState<
    Array<{ id: string; name: string; specialization: string }>
  >([])

  const fetchClinics = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    setLoading(true)
    try {
      const response = await fetch("/api/admin/clinics", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setClinics(data.clinics || [])
      }
    } catch (error) {
      console.error("Failed to fetch clinics:", error)
      toast({
        title: "Error",
        description: "Failed to fetch clinics. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

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
            clinicId: d.clinicId,
          }))
        )
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error)
    }
  }, [user])

  React.useEffect(() => {
    fetchClinics()
    fetchDoctors()
  }, [fetchClinics, fetchDoctors])

  const handleAssignDoctor = async (clinicId: string, doctorId: string) => {
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/doctors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          doctorId,
          action: "assign",
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Doctor assigned to clinic successfully",
        })
        fetchClinics()
        fetchDoctors()
        setIsAssignDoctorDialogOpen(false)
        setAssigningClinicId(null)
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to assign doctor")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to assign doctor",
        variant: "destructive",
      })
    }
  }

  const handleRemoveDoctor = async (clinicId: string, doctorId: string) => {
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/doctors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          doctorId,
          action: "remove",
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Doctor removed from clinic successfully",
        })
        fetchClinics()
        fetchDoctors()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to remove doctor")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove doctor",
        variant: "destructive",
      })
    }
  }

  const openAssignDoctorDialog = (clinicId: string) => {
    setAssigningClinicId(clinicId)
    // Get doctors not assigned to this clinic
    const unassignedDoctors = doctors.filter(
      (d) => d.clinicId !== clinicId && d.clinicId !== "default-clinic"
    )
    setAvailableDoctors(unassignedDoctors)
    setIsAssignDoctorDialogOpen(true)
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Clinic Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage clinics, assignments, and settings
            </p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Clinic
          </Button>
        </div>

        {/* Clinics List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="col-span-full flex items-center justify-center h-[400px]">
              <div className="text-muted-foreground">Loading clinics...</div>
            </div>
          ) : clinics.length === 0 ? (
            <div className="col-span-full flex items-center justify-center h-[400px]">
              <div className="text-center">
                <p className="text-muted-foreground">No clinics found</p>
              </div>
            </div>
          ) : (
            clinics.map((clinic) => {
              const clinicDoctors = doctors.filter((d) => d.clinicId === clinic.id)
              return (
                <Card key={clinic.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="h-5 w-5" />
                          {clinic.name}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          ID: {clinic.id}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingClinic(clinic)
                              setIsEditDialogOpen(true)
                            }}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Clinic
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedClinicId(clinic.id)
                              setIsSettingsDrawerOpen(true)
                            }}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openAssignDoctorDialog(clinic.id)}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Assign Doctor
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total Patients</p>
                          <p className="text-2xl font-bold">{clinic.totalPatients}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Total Doctors</p>
                          <p className="text-2xl font-bold">{clinic.totalDoctors}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Visits</p>
                          <p className="text-2xl font-bold">{clinic.monthlyVisits}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Monthly Appointments</p>
                          <p className="text-2xl font-bold">{clinic.monthlyAppointments}</p>
                        </div>
                      </div>

                      {/* Assigned Doctors */}
                      {clinicDoctors.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Assigned Doctors</p>
                          <div className="flex flex-wrap gap-2">
                            {clinicDoctors.slice(0, 3).map((doctor) => (
                              <Badge key={doctor.id} variant="outline">
                                {doctor.name}
                              </Badge>
                            ))}
                            {clinicDoctors.length > 3 && (
                              <Badge variant="outline">
                                +{clinicDoctors.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>
      </div>

      {/* Clinic Settings Drawer */}
      <ClinicSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => {
          setIsSettingsDrawerOpen(false)
          setSelectedClinicId(null)
        }}
        clinicId={selectedClinicId}
      />

      {/* Assign Doctor Dialog */}
      <Dialog
        open={isAssignDoctorDialogOpen}
        onOpenChange={setIsAssignDoctorDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Doctor to Clinic</DialogTitle>
            <DialogDescription>
              Select a doctor to assign to this clinic
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="doctor">Select Doctor</Label>
              <Select
                onValueChange={(doctorId) => {
                  if (assigningClinicId) {
                    handleAssignDoctor(assigningClinicId, doctorId)
                  }
                }}
              >
                <SelectTrigger id="doctor" className="mt-2">
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {availableDoctors.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No available doctors
                    </SelectItem>
                  ) : (
                    availableDoctors.map((doctor) => (
                      <SelectItem key={doctor.id} value={doctor.id}>
                        {doctor.name} ({doctor.specialization})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAssignDoctorDialogOpen(false)
                setAssigningClinicId(null)
              }}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Clinic Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Clinic</DialogTitle>
            <DialogDescription>
              Update clinic information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="clinicName">Clinic Name</Label>
              <Input
                id="clinicName"
                defaultValue={editingClinic?.name}
                placeholder="Enter clinic name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingClinic(null)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // TODO: Implement clinic update
                toast({
                  title: "Coming Soon",
                  description: "Clinic editing will be available after Clinic model is created",
                })
                setIsEditDialogOpen(false)
                setEditingClinic(null)
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

