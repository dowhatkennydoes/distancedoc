"use client"

import * as React from "react"
import { AdminLayout } from "@/components/admin/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Textarea,
} from "@/components/ui/textarea"
import {
  Shield,
  Filter,
  Download,
  Flag,
  Eye,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Search,
  X,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { format, parseISO, formatDistanceToNow } from "date-fns"
import { useAuditLogs, type AuditLog } from "@/hooks/useAuditLogs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function AdminAuditPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  
  // Filter states
  const [userIdFilter, setUserIdFilter] = React.useState<string>("")
  const [actionTypeFilter, setActionTypeFilter] = React.useState<string>("all")
  const [resourceTypeFilter, setResourceTypeFilter] = React.useState<string>("all")
  const [statusFilter, setStatusFilter] = React.useState<"all" | "success" | "failure">("all")
  const [clinicIdFilter, setClinicIdFilter] = React.useState<string>("")
  const [flaggedFilter, setFlaggedFilter] = React.useState<boolean | undefined>(undefined)
  const [realTimeMode, setRealTimeMode] = React.useState(true)
  const [selectedLog, setSelectedLog] = React.useState<AuditLog | null>(null)
  const [flagDialog, setFlagDialog] = React.useState<{
    open: boolean
    log: AuditLog | null
    reason: string
  }>({ open: false, log: null, reason: "" })

  // Use real-time hook with filters
  const { logs: realTimeLogs, loading: realTimeLoading } = useAuditLogs({
    userId: userIdFilter || undefined,
    actionType: actionTypeFilter !== "all" ? actionTypeFilter : undefined,
    resourceType: resourceTypeFilter !== "all" ? resourceTypeFilter : undefined,
    status: statusFilter,
    clinicId: clinicIdFilter || undefined,
    flagged: flaggedFilter,
    limitCount: 500,
  })

  // Fallback: fetch from API if real-time is disabled
  const [apiLogs, setApiLogs] = React.useState<AuditLog[]>([])
  const [apiLoading, setApiLoading] = React.useState(false)

  const fetchApiLogs = React.useCallback(async () => {
    if (realTimeMode) return

    setApiLoading(true)
    try {
      const params = new URLSearchParams()
      if (userIdFilter) params.append("userId", userIdFilter)
      if (actionTypeFilter !== "all") params.append("actionType", actionTypeFilter)
      if (resourceTypeFilter !== "all") params.append("resourceType", resourceTypeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter === "success" ? "success" : "failure")
      if (clinicIdFilter) params.append("clinicId", clinicIdFilter)
      if (flaggedFilter !== undefined) params.append("flagged", flaggedFilter.toString())

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setApiLogs(data.logs || [])
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error)
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      })
    } finally {
      setApiLoading(false)
    }
  }, [realTimeMode, userIdFilter, actionTypeFilter, resourceTypeFilter, statusFilter, clinicIdFilter, flaggedFilter, toast])

  React.useEffect(() => {
    if (!realTimeMode) {
      fetchApiLogs()
    }
  }, [realTimeMode, fetchApiLogs])

  const logs = realTimeMode ? realTimeLogs : apiLogs
  const loading = realTimeMode ? realTimeLoading : apiLoading

  const handleFlag = async () => {
    if (!flagDialog.log) return

    try {
      const response = await fetch(`/api/admin/audit-logs/${flagDialog.log.id}/flag`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          flagged: true,
          reason: flagDialog.reason || "Flagged as suspicious activity",
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Log entry flagged as suspicious",
        })
        setFlagDialog({ open: false, log: null, reason: "" })
        if (!realTimeMode) {
          fetchApiLogs() // Refresh if not using real-time
        }
      } else {
        throw new Error("Failed to flag log entry")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to flag log entry",
        variant: "destructive",
      })
    }
  }

  const handleUnflag = async (logId: string) => {
    try {
      const response = await fetch(`/api/admin/audit-logs/${logId}/flag`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          flagged: false,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Flag removed from log entry",
        })
        if (!realTimeMode) {
          fetchApiLogs()
        }
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to remove flag",
        variant: "destructive",
      })
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (userIdFilter) params.append("userId", userIdFilter)
      if (actionTypeFilter !== "all") params.append("actionType", actionTypeFilter)
      if (resourceTypeFilter !== "all") params.append("resourceType", resourceTypeFilter)
      if (statusFilter !== "all") params.append("status", statusFilter === "success" ? "success" : "failure")
      if (clinicIdFilter) params.append("clinicId", clinicIdFilter)
      if (flaggedFilter !== undefined) params.append("flagged", flaggedFilter.toString())

      const response = await fetch(`/api/admin/audit-logs/export?${params.toString()}`, {
        credentials: "include",
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `audit-logs-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: "Success",
          description: "Audit logs exported to CSV",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export audit logs",
        variant: "destructive",
      })
    }
  }

  const getDeviceIcon = (device?: string) => {
    switch (device?.toLowerCase()) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />
      case "tablet":
        return <Tablet className="h-4 w-4" />
      case "desktop":
        return <Monitor className="h-4 w-4" />
      default:
        return <Globe className="h-4 w-4" />
    }
  }

  const clearFilters = () => {
    setUserIdFilter("")
    setActionTypeFilter("all")
    setResourceTypeFilter("all")
    setStatusFilter("all")
    setClinicIdFilter("")
    setFlaggedFilter(undefined)
  }

  const actionTypes = [
    "VIEW_PATIENT_CHART",
    "VIEW_CONSULTATION",
    "DOWNLOAD_FILE",
    "LIST_PATIENT_FILES",
    "GENERATE_SOAP_NOTE",
    "ACCESS_VISIT_TRANSCRIPT",
    "LOGIN",
    "LOGOUT",
    "CREATE_APPOINTMENT",
    "UPDATE_APPOINTMENT",
    "DELETE_APPOINTMENT",
  ]

  const resourceTypes = [
    "patient",
    "consultation",
    "file",
    "visit_note",
    "appointment",
    "user",
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground mt-1">
              Real-time audit trail of all system activities
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={realTimeMode ? "default" : "outline"}
              onClick={() => setRealTimeMode(!realTimeMode)}
            >
              {realTimeMode ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Live
                </>
              ) : (
                <>
                  <Clock className="h-4 w-4 mr-2" />
                  Static
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Filters</CardTitle>
                <CardDescription>Filter audit logs by various criteria</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  placeholder="Filter by user ID"
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="actionType">Action Type</Label>
                <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                  <SelectTrigger id="actionType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {actionTypes.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="resourceType">Resource Type</Label>
                <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                  <SelectTrigger id="resourceType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Resources</SelectItem>
                    {resourceTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value: "all" | "success" | "failure") => setStatusFilter(value)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="failure">Failure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="clinicId">Clinic ID</Label>
                <Input
                  id="clinicId"
                  placeholder="Filter by clinic ID"
                  value={clinicIdFilter}
                  onChange={(e) => setClinicIdFilter(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="flagged">Flagged</Label>
                <Select
                  value={flaggedFilter === undefined ? "all" : flaggedFilter.toString()}
                  onValueChange={(value) =>
                    setFlaggedFilter(value === "all" ? undefined : value === "true")
                  }
                >
                  <SelectTrigger id="flagged">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="true">Flagged Only</SelectItem>
                    <SelectItem value="false">Not Flagged</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Log Entries</CardTitle>
            <CardDescription>
              {realTimeMode
                ? "Real-time audit log stream (live updates)"
                : "Static audit log view"}
              {logs.length > 0 && ` • ${logs.length} entries`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-muted-foreground">Loading audit logs...</div>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No audit logs found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try adjusting your filters
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>IP / Device</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow
                        key={log.id}
                        className={log.flagged ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}
                      >
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {format(parseISO(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(parseISO(log.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.userId.slice(0, 8)}...</p>
                            <p className="text-xs text-muted-foreground">{log.clinicId}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{log.action}</p>
                            {log.requestId && (
                              <p className="text-xs text-muted-foreground">
                                ID: {log.requestId.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Badge variant="outline">{log.resourceType}</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {log.resourceId.slice(0, 12)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getDeviceIcon(log.device)}
                            <div>
                              <p className="text-sm">{log.ip}</p>
                              <p className="text-xs text-muted-foreground">{log.device || "Unknown"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="default" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </Badge>
                          )}
                          {log.flagged && (
                            <Badge variant="destructive" className="mt-1 gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Flagged
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setSelectedLog(log)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {log.flagged ? (
                                <DropdownMenuItem onClick={() => handleUnflag(log.id)}>
                                  <X className="h-4 w-4 mr-2" />
                                  Remove Flag
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setFlagDialog({ open: true, log, reason: "" })
                                  }
                                >
                                  <Flag className="h-4 w-4 mr-2" />
                                  Flag Suspicious
                                </DropdownMenuItem>
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
          </CardContent>
        </Card>
      </div>

      {/* Log Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>Complete details for this audit log entry</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Timestamp</Label>
                  <p className="text-sm font-mono">
                    {format(parseISO(selectedLog.timestamp), "yyyy-MM-dd HH:mm:ss.SSS")}
                  </p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p>
                    {selectedLog.success ? (
                      <Badge variant="default">Success</Badge>
                    ) : (
                      <Badge variant="destructive">Failed</Badge>
                    )}
                  </p>
                </div>
                <div>
                  <Label>User ID</Label>
                  <p className="text-sm font-mono">{selectedLog.userId}</p>
                </div>
                <div>
                  <Label>Clinic ID</Label>
                  <p className="text-sm font-mono">{selectedLog.clinicId}</p>
                </div>
                <div>
                  <Label>Action</Label>
                  <p className="text-sm font-medium">{selectedLog.action}</p>
                </div>
                <div>
                  <Label>Resource Type</Label>
                  <p className="text-sm">{selectedLog.resourceType}</p>
                </div>
                <div>
                  <Label>Resource ID</Label>
                  <p className="text-sm font-mono">{selectedLog.resourceId}</p>
                </div>
                <div>
                  <Label>IP Address</Label>
                  <p className="text-sm font-mono">{selectedLog.ip}</p>
                </div>
                <div>
                  <Label>Device</Label>
                  <p className="text-sm">{selectedLog.device || "Unknown"}</p>
                </div>
                <div>
                  <Label>Request ID</Label>
                  <p className="text-sm font-mono">{selectedLog.requestId || "N/A"}</p>
                </div>
                {selectedLog.userAgent && (
                  <div className="col-span-2">
                    <Label>User Agent</Label>
                    <p className="text-sm break-all">{selectedLog.userAgent}</p>
                  </div>
                )}
                {selectedLog.flagged && (
                  <>
                    <div>
                      <Label>Flagged</Label>
                      <Badge variant="destructive">Yes</Badge>
                    </div>
                    <div>
                      <Label>Flag Reason</Label>
                      <p className="text-sm">{selectedLog.flaggedReason || "N/A"}</p>
                    </div>
                    {selectedLog.flaggedBy && (
                      <div>
                        <Label>Flagged By</Label>
                        <p className="text-sm font-mono">{selectedLog.flaggedBy}</p>
                      </div>
                    )}
                    {selectedLog.flaggedAt && (
                      <div>
                        <Label>Flagged At</Label>
                        <p className="text-sm">
                          {format(parseISO(selectedLog.flaggedAt), "MMM d, yyyy HH:mm:ss")}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <Label>Metadata</Label>
                  <pre className="text-xs bg-muted p-3 rounded mt-2 overflow-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flag Dialog */}
      <Dialog open={flagDialog.open} onOpenChange={(open) => setFlagDialog({ open, log: null, reason: "" })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Suspicious Activity</DialogTitle>
            <DialogDescription>
              Mark this audit log entry as suspicious and provide a reason
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for flagging this activity..."
                value={flagDialog.reason}
                onChange={(e) => setFlagDialog((prev) => ({ ...prev, reason: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFlagDialog({ open: false, log: null, reason: "" })}
            >
              Cancel
            </Button>
            <Button onClick={handleFlag} disabled={!flagDialog.reason.trim()}>
              <Flag className="h-4 w-4 mr-2" />
              Flag Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

