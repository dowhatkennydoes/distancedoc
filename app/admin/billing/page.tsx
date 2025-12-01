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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  FileText,
  RefreshCw,
  MoreVertical,
  Download,
  ArrowUpCircle,
  ArrowDownCircle,
  XCircle,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  Clock,
  X,
  Calendar,
  Eye,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { format, parseISO } from "date-fns"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface Customer {
  id: string
  email: string | null
  name: string | null
  created: string
  subscription: {
    id: string
    status: string
    currentPeriodEnd: string
    plan: string
    amount: number
    currency: string
  } | null
}

interface ClinicSubscription {
  clinicId: string
  clinicName: string
  subscriptions: Array<{
    id: string
    status: string
    customerId: string
    customerEmail: string | null
    plan: string
    amount: number
    currency: string
    currentPeriodStart: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    canceledAt: string | null
  }>
  totalMRR: number
  status: string
}

interface PaymentFailure {
  type: "payment_intent" | "invoice"
  id: string
  customerId: string | null
  amount: number
  currency: string
  status: string
  lastPaymentError: {
    message: string
    type: string
    code: string | null
  } | null
  attemptCount?: number
  nextPaymentAttempt?: string | null
  createdAt: string
}

interface Invoice {
  id: string
  number: string | null
  customerId: string | null
  customerEmail: string | null
  subscriptionId: string | null
  amount: number
  currency: string
  status: string
  paid: boolean
  amountPaid: number
  amountDue: number
  periodStart: string | null
  periodEnd: string | null
  dueDate: string | null
  hostedInvoiceUrl: string | null
  invoicePdf: string | null
  createdAt: string
}

export default function AdminBillingPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState("overview")

  // State for different sections
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [subscriptions, setSubscriptions] = React.useState<ClinicSubscription[]>([])
  const [mrrData, setMrrData] = React.useState<Array<{ month: string; mrr: number; new: number; churned: number }>>([])
  const [currentMRR, setCurrentMRR] = React.useState(0)
  const [paymentFailures, setPaymentFailures] = React.useState<PaymentFailure[]>([])
  const [invoices, setInvoices] = React.useState<Invoice[]>([])

  // Dialog states
  const [refundDialog, setRefundDialog] = React.useState<{
    open: boolean
    paymentId?: string
    chargeId?: string
    amount?: number
  }>({ open: false })
  const [subscriptionDialog, setSubscriptionDialog] = React.useState<{
    open: boolean
    subscriptionId?: string
    action?: "upgrade" | "downgrade" | "cancel" | "resume"
  }>({ open: false })

  // Fetch all billing data
  const fetchAllData = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    setLoading(true)
    try {
      // Fetch all data in parallel
      const [customersRes, subscriptionsRes, mrrRes, failuresRes, invoicesRes] =
        await Promise.all([
          fetch("/api/admin/billing/customers", { credentials: "include" }),
          fetch("/api/admin/billing/subscriptions", { credentials: "include" }),
          fetch("/api/admin/billing/mrr?months=12", { credentials: "include" }),
          fetch("/api/admin/billing/payment-failures?days=30", { credentials: "include" }),
          fetch("/api/admin/billing/invoices?limit=100", { credentials: "include" }),
        ])

      if (customersRes.ok) {
        const data = await customersRes.json()
        setCustomers(data.customers || [])
      }

      if (subscriptionsRes.ok) {
        const data = await subscriptionsRes.json()
        setSubscriptions(data.subscriptions || [])
      }

      if (mrrRes.ok) {
        const data = await mrrRes.json()
        setMrrData(data.monthlyData || [])
        setCurrentMRR(data.currentMRR || 0)
      }

      if (failuresRes.ok) {
        const data = await failuresRes.json()
        setPaymentFailures(data.failures || [])
      }

      if (invoicesRes.ok) {
        const data = await invoicesRes.json()
        setInvoices(data.invoices || [])
      }
    } catch (error) {
      console.error("Failed to fetch billing data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch billing data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  React.useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  const handleRefund = async () => {
    if (!refundDialog.paymentId && !refundDialog.chargeId) return

    try {
      const response = await fetch("/api/admin/billing/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          paymentIntentId: refundDialog.paymentId,
          chargeId: refundDialog.chargeId,
          amount: refundDialog.amount,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Refund processed successfully",
        })
        setRefundDialog({ open: false })
        fetchAllData()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to process refund")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process refund",
        variant: "destructive",
      })
    }
  }

  const handleSubscriptionAction = async (action: string, priceId?: string) => {
    if (!subscriptionDialog.subscriptionId) return

    try {
      const response = await fetch(
        `/api/admin/billing/subscription/${subscriptionDialog.subscriptionId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action,
            priceId,
          }),
        }
      )

      if (response.ok) {
        toast({
          title: "Success",
          description: `Subscription ${action}d successfully`,
        })
        setSubscriptionDialog({ open: false })
        fetchAllData()
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to update subscription")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update subscription",
        variant: "destructive",
      })
    }
  }

  const handleExport = async (type: "invoices" | "customers" | "subscriptions") => {
    try {
      const response = await fetch(`/api/admin/billing/export?type=${type}`, {
        credentials: "include",
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `billing-export-${type}-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)

        toast({
          title: "Success",
          description: `Exported ${type} to CSV`,
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
    > = {
      active: { variant: "default", label: "Active" },
      trialing: { variant: "secondary", label: "Trialing" },
      past_due: { variant: "destructive", label: "Past Due" },
      canceled: { variant: "outline", label: "Canceled" },
      unpaid: { variant: "destructive", label: "Unpaid" },
      paid: { variant: "default", label: "Paid" },
      open: { variant: "destructive", label: "Open" },
      draft: { variant: "outline", label: "Draft" },
      void: { variant: "outline", label: "Void" },
      payment_failed: { variant: "destructive", label: "Failed" },
    }

    const statusInfo = statusMap[status] || {
      variant: "outline" as const,
      label: status,
    }
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
            <p className="text-muted-foreground mt-1">
              Manage Stripe customers, subscriptions, and payments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={fetchAllData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport("customers")}>
                  Export Customers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("subscriptions")}>
                  Export Subscriptions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("invoices")}>
                  Export Invoices
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="text-muted-foreground">Loading billing data...</div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
              <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
              <TabsTrigger value="failures">Payment Failures</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4">
              {/* Key Metrics */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Current MRR</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${currentMRR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {subscriptions.reduce((sum, sub) => sum + sub.subscriptions.filter(s => s.status === "active" || s.status === "trialing").length, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Active customers</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Payment Failures</CardTitle>
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-destructive">{paymentFailures.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{customers.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">All customers</p>
                  </CardContent>
                </Card>
              </div>

              {/* MRR Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Recurring Revenue (MRR)</CardTitle>
                  <CardDescription>MRR trend over the last 12 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mrrData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip
                        formatter={(value: number) => `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="mrr"
                        stroke="#8884d8"
                        strokeWidth={2}
                        name="MRR"
                      />
                      <Line
                        type="monotone"
                        dataKey="new"
                        stroke="#82ca9d"
                        strokeWidth={2}
                        name="New MRR"
                      />
                      <Line
                        type="monotone"
                        dataKey="churned"
                        stroke="#ffc658"
                        strokeWidth={2}
                        name="Churned MRR"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Customers Tab - Continue in next part due to length */}
            <TabsContent value="customers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Stripe Customers</CardTitle>
                  <CardDescription>All customers in your Stripe account</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Subscription</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>MRR</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customers.map((customer) => (
                          <TableRow key={customer.id}>
                            <TableCell className="font-medium">{customer.email || "N/A"}</TableCell>
                            <TableCell>{customer.name || "N/A"}</TableCell>
                            <TableCell>
                              {customer.subscription ? (
                                <div>
                                  <p className="font-medium">{customer.subscription.plan}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Renews {format(parseISO(customer.subscription.currentPeriodEnd), "MMM d, yyyy")}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No subscription</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {customer.subscription
                                ? getStatusBadge(customer.subscription.status)
                                : <Badge variant="outline">None</Badge>}
                            </TableCell>
                            <TableCell>
                              {customer.subscription
                                ? `$${(customer.subscription.amount / 100).toFixed(2)}`
                                : "$0.00"}
                            </TableCell>
                            <TableCell>{format(parseISO(customer.created), "MMM d, yyyy")}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscriptions Tab */}
            <TabsContent value="subscriptions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Clinic Subscriptions</CardTitle>
                  <CardDescription>Subscription statuses by clinic</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {subscriptions.map((clinic) => (
                      <Card key={clinic.clinicId}>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle>{clinic.clinicName}</CardTitle>
                              <CardDescription>
                                Total MRR: ${clinic.totalMRR.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </CardDescription>
                            </div>
                            {getStatusBadge(clinic.status)}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {clinic.subscriptions.map((sub) => (
                              <div
                                key={sub.id}
                                className="flex items-center justify-between p-3 border rounded"
                              >
                                <div>
                                  <p className="font-medium">{sub.plan}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {sub.customerEmail || sub.customerId}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(sub.currentPeriodStart), "MMM d")} -{" "}
                                    {format(parseISO(sub.currentPeriodEnd), "MMM d, yyyy")}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getStatusBadge(sub.status)}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setSubscriptionDialog({
                                            open: true,
                                            subscriptionId: sub.id,
                                            action: "upgrade",
                                          })
                                        }
                                      >
                                        <ArrowUpCircle className="h-4 w-4 mr-2" />
                                        Upgrade
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setSubscriptionDialog({
                                            open: true,
                                            subscriptionId: sub.id,
                                            action: "downgrade",
                                          })
                                        }
                                      >
                                        <ArrowDownCircle className="h-4 w-4 mr-2" />
                                        Downgrade
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() =>
                                          setSubscriptionDialog({
                                            open: true,
                                            subscriptionId: sub.id,
                                            action: sub.cancelAtPeriodEnd
                                              ? "resume"
                                              : "cancel",
                                          })
                                        }
                                      >
                                        {sub.cancelAtPeriodEnd ? (
                                          <>
                                            <RefreshCw className="h-4 w-4 mr-2" />
                                            Resume
                                          </>
                                        ) : (
                                          <>
                                            <XCircle className="h-4 w-4 mr-2" />
                                            Cancel
                                          </>
                                        )}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Failures Tab */}
            <TabsContent value="failures" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Failures</CardTitle>
                  <CardDescription>Failed payments from the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Error</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentFailures.map((failure) => (
                          <TableRow key={failure.id}>
                            <TableCell>
                              <Badge variant="outline">{failure.type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {failure.customerId || "N/A"}
                            </TableCell>
                            <TableCell>
                              ${(failure.amount / 100).toFixed(2)} {failure.currency.toUpperCase()}
                            </TableCell>
                            <TableCell>
                              {failure.lastPaymentError ? (
                                <div>
                                  <p className="text-sm font-medium text-destructive">
                                    {failure.lastPaymentError.message}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {failure.lastPaymentError.code || failure.lastPaymentError.type}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">No error details</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {format(parseISO(failure.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setRefundDialog({
                                    open: true,
                                    paymentId: failure.type === "payment_intent" ? failure.id : undefined,
                                  })
                                }
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Refund
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Invoice History</CardTitle>
                  <CardDescription>All invoices from Stripe</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoices.map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">
                              {invoice.number || invoice.id.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              {invoice.customerEmail || invoice.customerId || "N/A"}
                            </TableCell>
                            <TableCell>
                              ${(invoice.amount / 100).toFixed(2)} {invoice.currency.toUpperCase()}
                            </TableCell>
                            <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                            <TableCell>
                              {invoice.periodStart && invoice.periodEnd ? (
                                <div>
                                  <p className="text-sm">
                                    {format(parseISO(invoice.periodStart), "MMM d")} -{" "}
                                    {format(parseISO(invoice.periodEnd), "MMM d, yyyy")}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {format(parseISO(invoice.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              {invoice.hostedInvoiceUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => window.open(invoice.hostedInvoiceUrl || "", "_blank")}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Refund Dialog */}
      <Dialog open={refundDialog.open} onOpenChange={(open) => setRefundDialog({ open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Refund</DialogTitle>
            <DialogDescription>
              Refund the payment to the customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {refundDialog.amount !== undefined && (
              <div>
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={refundDialog.amount}
                  onChange={(e) =>
                    setRefundDialog((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog({ open: false })}>
              Cancel
            </Button>
            <Button onClick={handleRefund}>Process Refund</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Action Dialog */}
      <Dialog
        open={subscriptionDialog.open}
        onOpenChange={(open) => setSubscriptionDialog({ open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {subscriptionDialog.action === "upgrade"
                ? "Upgrade Subscription"
                : subscriptionDialog.action === "downgrade"
                ? "Downgrade Subscription"
                : subscriptionDialog.action === "cancel"
                ? "Cancel Subscription"
                : "Resume Subscription"}
            </DialogTitle>
            <DialogDescription>
              {subscriptionDialog.action === "cancel"
                ? "The subscription will be canceled at the end of the current billing period."
                : subscriptionDialog.action === "resume"
                ? "The subscription will continue after the current billing period."
                : "Update the subscription plan."}
            </DialogDescription>
          </DialogHeader>
          {(subscriptionDialog.action === "upgrade" ||
            subscriptionDialog.action === "downgrade") && (
            <div className="space-y-4">
              <div>
                <Label>Select New Plan</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="price_basic">Basic Plan - $99/month</SelectItem>
                    <SelectItem value="price_pro">Pro Plan - $199/month</SelectItem>
                    <SelectItem value="price_enterprise">Enterprise Plan - $499/month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscriptionDialog({ open: false })}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                subscriptionDialog.action &&
                handleSubscriptionAction(
                  subscriptionDialog.action,
                  subscriptionDialog.action === "upgrade" || subscriptionDialog.action === "downgrade"
                    ? "price_pro" // TODO: Get from select
                    : undefined
                )
              }
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}

