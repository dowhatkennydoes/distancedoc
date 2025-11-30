"use client"

import { useEffect, useState } from "react"
import { PatientPortalLayout } from "@/components/layouts/PatientPortalLayout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { useToast } from "@/components/ui/use-toast"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import {
  CreditCard,
  Download,
  Receipt,
  DollarSign,
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  Plus,
  Trash2,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import Link from "next/link"

interface Payment {
  id: string
  amount: number
  currency: string
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED" | "CANCELLED"
  description?: string
  appointmentId?: string
  paidAt?: string
  receiptUrl?: string
  createdAt: string
}

interface VisitCharge {
  id: string
  appointmentId: string
  amount: number
  currency: string
  status: "PENDING" | "PAID" | "OVERDUE"
  appointmentDate: string
  doctorName: string
  visitType: string
  paymentId?: string
}

interface PaymentMethod {
  id: string
  type: "card"
  card: {
    brand: string
    last4: string
    expMonth: number
    expYear: number
  }
  isDefault: boolean
}

export default function PatientBillingPage() {
  const { toast } = useToast()
  const [payments, setPayments] = useState<Payment[]>([])
  const [visitCharges, setVisitCharges] = useState<VisitCharge[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null)

  useEffect(() => {
    fetchBillingData()
  }, [])

  const fetchBillingData = async () => {
    try {
      // Fetch payments
      const paymentsResponse = await fetch("/api/payments/patient", {
        credentials: "include",
      })
      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json()
        setPayments(paymentsData || [])
      }

      // Fetch visit charges (unpaid appointments)
      const appointmentsResponse = await fetch("/api/appointments/patient", {
        credentials: "include",
      })
      if (appointmentsResponse.ok) {
        const appointments = await appointmentsResponse.ok ? await appointmentsResponse.json() : []
        // Filter for completed appointments without payments
        const charges: VisitCharge[] = appointments
          .filter((apt: any) => apt.status === "COMPLETED" && !apt.paymentId)
          .map((apt: any) => ({
            id: `charge-${apt.id}`,
            appointmentId: apt.id,
            amount: 150, // TODO: Get actual charge amount from appointment
            currency: "usd",
            status: "PENDING" as const,
            appointmentDate: apt.scheduledAt,
            doctorName: apt.doctor.name,
            visitType: apt.visitType,
          }))
        setVisitCharges(charges)
      }

      // Fetch payment methods from Stripe
      await fetchPaymentMethods()
    } catch (error) {
      console.error("Error fetching billing data:", error)
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch("/api/payments/methods", {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setPaymentMethods(data.paymentMethods || [])
      } else {
        // Use sample data if API not implemented
        setPaymentMethods([
          {
            id: "pm_sample",
            type: "card",
            card: {
              brand: "visa",
              last4: "4242",
              expMonth: 12,
              expYear: 2025,
            },
            isDefault: true,
          },
        ])
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error)
    }
  }

  const handleDownloadReceipt = async (payment: Payment) => {
    if (payment.receiptUrl) {
      window.open(payment.receiptUrl, "_blank", "noopener,noreferrer")
    } else {
      // TODO: Generate receipt PDF
      toast({
        title: "Receipt Not Available",
        description: "Receipt generation coming soon.",
        variant: "default",
      })
    }
  }

  const handleAddPaymentMethod = async () => {
    try {
      // TODO: Open Stripe payment method setup
      const response = await fetch("/api/payments/setup-intent", {
        method: "POST",
        credentials: "include",
      })

      if (response.ok) {
        const { clientSecret } = await response.json()
        // TODO: Open Stripe Elements to add card
        toast({
          title: "Add Payment Method",
          description: "Payment method setup coming soon.",
          variant: "default",
        })
      } else {
        throw new Error("Failed to create setup intent")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add payment method",
        variant: "destructive",
      })
    }
  }

  const handleDeletePaymentMethod = async (methodId: string) => {
    setDeletingCardId(methodId)
    try {
      const response = await fetch(`/api/payments/methods/${methodId}`, {
        method: "DELETE",
        credentials: "include",
      })

      if (response.ok) {
        toast({
          title: "Payment Method Removed",
          description: "Your payment method has been removed successfully.",
          variant: "success",
        })
        fetchPaymentMethods()
      } else {
        throw new Error("Failed to delete payment method")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to remove payment method",
        variant: "destructive",
      })
    } finally {
      setDeletingCardId(null)
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
      PROCESSING: { variant: "secondary", icon: Clock },
      FAILED: { variant: "destructive", icon: XCircle },
      REFUNDED: { variant: "outline", icon: AlertCircle },
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

  const getCardBrandIcon = (brand: string) => {
    return <CreditCard className="h-5 w-5" />
  }

  if (loading) {
    return (
      <PatientPortalLayout>
        <PageSkeleton />
      </PatientPortalLayout>
    )
  }

  const totalPaid = payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + p.amount, 0)

  const pendingCharges = visitCharges
    .filter((c) => c.status === "PENDING")
    .reduce((sum, c) => sum + c.amount, 0)

  return (
    <PatientPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
          <p className="text-muted-foreground mt-2">Manage your payments and payment methods</p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalPaid)}</div>
              <p className="text-xs text-muted-foreground mt-1">All time payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Charges</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(pendingCharges)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {visitCharges.filter((c) => c.status === "PENDING").length} unpaid visits
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{paymentMethods.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Saved cards</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="charges" className="space-y-4">
          <TabsList>
            <TabsTrigger value="charges">
              <Receipt className="h-4 w-4 mr-2" />
              Visit Charges ({visitCharges.length})
            </TabsTrigger>
            <TabsTrigger value="history">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment History ({payments.length})
            </TabsTrigger>
            <TabsTrigger value="methods">
              <CreditCard className="h-4 w-4 mr-2" />
              Payment Methods
            </TabsTrigger>
          </TabsList>

          {/* Visit Charges Tab */}
          <TabsContent value="charges" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Visit Charges</CardTitle>
                <CardDescription>Unpaid charges from completed visits</CardDescription>
              </CardHeader>
              <CardContent>
                {visitCharges.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No pending charges</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Doctor</TableHead>
                          <TableHead>Visit Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitCharges.map((charge) => (
                          <TableRow key={charge.id}>
                            <TableCell>
                              {format(parseISO(charge.appointmentDate), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="font-medium">{charge.doctorName}</TableCell>
                            <TableCell>{charge.visitType.replace("_", " ")}</TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(charge.amount, charge.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={charge.status === "PENDING" ? "secondary" : "default"}>
                                {charge.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" asChild>
                                <Link href={`/patient/payments/pay/${charge.appointmentId}`}>
                                  Pay Now
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>All your past payments and receipts</CardDescription>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CreditCard className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>No payment history</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {payment.paidAt
                                ? format(parseISO(payment.paidAt), "MMM d, yyyy")
                                : format(parseISO(payment.createdAt), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{payment.description || "Payment"}</div>
                                {payment.appointmentId && (
                                  <Link
                                    href={`/patient/visits/${payment.appointmentId}`}
                                    className="text-xs text-muted-foreground hover:text-primary"
                                  >
                                    View Appointment
                                  </Link>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(payment.amount, payment.currency)}
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                            <TableCell className="text-right">
                              {payment.receiptUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDownloadReceipt(payment)}
                                >
                                  <Download className="h-4 w-4 mr-2" />
                                  Receipt
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Methods Tab */}
          <TabsContent value="methods" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payment Methods</CardTitle>
                    <CardDescription>Manage your saved payment methods</CardDescription>
                  </div>
                  <Button onClick={handleAddPaymentMethod}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Card
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {paymentMethods.length === 0 ? (
                  <div className="text-center py-12">
                    <CreditCard className="mx-auto h-12 w-12 mb-4 text-muted-foreground opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No Payment Methods</h3>
                    <p className="text-muted-foreground mb-6">
                      Add a payment method to make payments faster and easier.
                    </p>
                    <Button onClick={handleAddPaymentMethod}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Payment Method
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {paymentMethods.map((method) => (
                      <Card key={method.id} className={method.isDefault ? "border-primary" : ""}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              {getCardBrandIcon(method.card.brand)}
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {method.card.brand.toUpperCase()} •••• {method.card.last4}
                                  </span>
                                  {method.isDefault && (
                                    <Badge variant="default" className="text-xs">Default</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Expires {method.card.expMonth}/{method.card.expYear}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!method.isDefault && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    // TODO: Set as default
                                    toast({
                                      title: "Set as Default",
                                      description: "Setting default payment method coming soon.",
                                      variant: "default",
                                    })
                                  }}
                                >
                                  Set Default
                                </Button>
                              )}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Remove Payment Method</DialogTitle>
                                    <DialogDescription>
                                      Are you sure you want to remove this payment method? This action cannot be undone.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <DialogFooter>
                                    <Button variant="outline">Cancel</Button>
                                    <Button
                                      variant="destructive"
                                      onClick={() => handleDeletePaymentMethod(method.id)}
                                      disabled={deletingCardId === method.id}
                                    >
                                      {deletingCardId === method.id ? "Removing..." : "Remove"}
                                    </Button>
                                  </DialogFooter>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Portal Link */}
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                      Manage Billing in Stripe
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Access your full billing portal to view invoices, update payment methods, and more.
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => {
                    // TODO: Open Stripe customer portal
                    toast({
                      title: "Stripe Portal",
                      description: "Stripe customer portal integration coming soon.",
                      variant: "default",
                    })
                  }}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Portal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PatientPortalLayout>
  )
}
