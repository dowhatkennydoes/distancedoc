"use client"

import { useEffect, useState } from "react"
import { DoctorDashboardLayout } from "@/components/layouts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/use-toast"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import {
  DollarSign,
  Clock,
  CreditCard,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  Download,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { useAuth } from "@/contexts/AuthContext"

interface Payment {
  id: string
  patientName: string
  patientEmail: string
  amount: number
  currency: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED"
  description: string
  appointmentId?: string
  appointmentDate?: string
  stripePaymentId?: string
  receiptUrl?: string
  paidAt?: string
  createdAt: string
}

interface BillingData {
  totalEarnings: number
  pendingEarnings: number
  refundedAmount: number
  payments: Payment[]
  subscriptionStatus: {
    active: boolean
    plan: string
    currentPeriodEnd: string
    stripeCustomerId?: string | null
  }
  stats: {
    totalPayments: number
    completedPayments: number
    pendingPayments: number
    refundedPayments: number
  }
}

export default function DoctorBillingPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null)
  const [refundReasons, setRefundReasons] = useState<Record<string, string>>({})
  const [refundDialogOpen, setRefundDialogOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!authLoading && user) {
      fetchBillingData()
    }
  }, [user, authLoading])

  const fetchBillingData = async () => {
    try {
      const response = await fetch("/api/billing/doctor", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch billing data")
      }

      const data = await response.json()
      setBillingData(data)
    } catch (error: any) {
      console.error("Error fetching billing data:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to load billing data",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRefund = async (paymentId: string) => {
    setRefundingPaymentId(paymentId)
    try {
      const response = await fetch("/api/billing/doctor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          paymentId,
          reason: refundReasons[paymentId] || "No reason provided",
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to process refund")
      }

      toast({
        title: "Refund Processed",
        description: "Refund has been processed successfully",
        variant: "success",
      })

      setRefundDialogOpen((prev) => ({ ...prev, [paymentId]: false }))
      setRefundReasons((prev) => {
        const newReasons = { ...prev }
        delete newReasons[paymentId]
        return newReasons
      })
      fetchBillingData() // Refresh data
    } catch (error: any) {
      toast({
        title: "Refund Failed",
        description: error.message || "Failed to process refund. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRefundingPaymentId(null)
    }
  }

  const formatCurrency = (amount: number, currency: string = "usd"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount)
  }

  const getStatusBadge = (status: Payment["status"]) => {
    const variants: Record<Payment["status"], { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      COMPLETED: { variant: "default", icon: CheckCircle2 },
      PENDING: { variant: "secondary", icon: Clock },
      PROCESSING: { variant: "secondary", icon: Loader2 },
      FAILED: { variant: "destructive", icon: XCircle },
      REFUNDED: { variant: "outline", icon: RefreshCw },
      CANCELLED: { variant: "outline", icon: XCircle },
    }

    const config = variants[status] || variants.PENDING
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  const handleStripePortal = async () => {
    // TODO: Generate Stripe customer portal session
    // For now, show a message
    toast({
      title: "Stripe Portal",
      description: "Stripe customer portal integration coming soon",
      variant: "default",
    })
  }

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <PageSkeleton />
      </DoctorDashboardLayout>
    )
  }

  if (!billingData) {
    return (
      <DoctorDashboardLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Failed to load billing data</p>
          <Button onClick={fetchBillingData} className="mt-4">
            Retry
          </Button>
        </div>
      </DoctorDashboardLayout>
    )
  }

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
            <p className="text-muted-foreground mt-2">Manage your earnings, payments, and subscription</p>
          </div>
          <Button variant="outline" onClick={handleStripePortal}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Stripe Portal
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(billingData.totalEarnings)}</div>
              <p className="text-xs text-muted-foreground mt-1">All time completed payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Payouts</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(billingData.pendingEarnings)}</div>
              <p className="text-xs text-muted-foreground mt-1">Pending and processing</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Refunded</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(billingData.refundedAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total refunded amount</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{billingData.stats.totalPayments}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {billingData.stats.completedPayments} completed
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Subscription Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Subscription Status
            </CardTitle>
            <CardDescription>Your current subscription plan and billing information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={billingData.subscriptionStatus.active ? "default" : "secondary"}>
                    {billingData.subscriptionStatus.active ? "Active" : "Inactive"}
                  </Badge>
                  <span className="font-medium">{billingData.subscriptionStatus.plan} Plan</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Current period ends: {format(parseISO(billingData.subscriptionStatus.currentPeriodEnd), "MMMM d, yyyy")}
                </p>
              </div>
              <Button variant="outline" onClick={handleStripePortal}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Manage Subscription
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Patient Payments List */}
        <Card>
          <CardHeader>
            <CardTitle>Patient Payments</CardTitle>
            <CardDescription>All payments from your patients</CardDescription>
          </CardHeader>
          <CardContent>
            {billingData.payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No payments found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billingData.payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">
                          {payment.paidAt
                            ? format(parseISO(payment.paidAt), "MMM d, yyyy")
                            : format(parseISO(payment.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.patientName}</div>
                            <div className="text-sm text-muted-foreground">{payment.patientEmail}</div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(payment.amount, payment.currency)}
                        </TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="max-w-xs truncate">{payment.description}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {payment.receiptUrl && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {payment.status === "COMPLETED" && (
                              <Dialog 
                                open={refundDialogOpen[payment.id] || false} 
                                onOpenChange={(open) => {
                                  setRefundDialogOpen((prev) => ({ ...prev, [payment.id]: open }))
                                  if (!open) {
                                    setRefundReasons((prev) => {
                                      const newReasons = { ...prev }
                                      delete newReasons[payment.id]
                                      return newReasons
                                    })
                                  }
                                }}
                              >
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <RefreshCw className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Process Refund</DialogTitle>
                                    <DialogDescription>
                                      Refund {formatCurrency(payment.amount, payment.currency)} to {payment.patientName}
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                      <Label htmlFor={`refund-reason-${payment.id}`}>Reason for Refund</Label>
                                      <Textarea
                                        id={`refund-reason-${payment.id}`}
                                        value={refundReasons[payment.id] || ""}
                                        onChange={(e) => setRefundReasons((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                                        placeholder="Enter reason for refund..."
                                        rows={3}
                                      />
                                    </div>
                                    <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-3">
                                      <div className="flex items-start gap-2">
                                        <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                                        <p className="text-sm text-yellow-900 dark:text-yellow-100">
                                          This action cannot be undone. The refund will be processed immediately.
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <DialogFooter>
                                    <Button
                                      variant="outline"
                                      onClick={() => {
                                        setRefundDialogOpen((prev) => ({ ...prev, [payment.id]: false }))
                                        setRefundReasons((prev) => {
                                          const newReasons = { ...prev }
                                          delete newReasons[payment.id]
                                          return newReasons
                                        })
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      onClick={() => handleRefund(payment.id)}
                                      disabled={refundingPaymentId === payment.id}
                                      variant="destructive"
                                    >
                                      {refundingPaymentId === payment.id ? (
                                        <>
                                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                          Processing...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-4 w-4 mr-2" />
                                          Process Refund
                                        </>
                                      )}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
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
    </DoctorDashboardLayout>
  )
}

