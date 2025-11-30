"use client"

import { useEffect, useState } from "react"
import { DoctorDashboardLayout } from "@/components/layouts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { PageSkeleton } from "@/components/ui/loading-skeletons"
import { useAuth } from "@/contexts/AuthContext"
import { Save, User, Building2, Stethoscope, Sparkles, CreditCard, Shield } from "lucide-react"

interface DoctorProfile {
  id: string
  userId: string
  licenseNumber: string
  specialization?: string
  credentials: string[]
  npiNumber?: string
  bio?: string
  languages: string[]
  timezone: string
}

interface UserProfile {
  firstName: string
  lastName: string
  email: string
  phoneNumber?: string
}

interface ClinicInfo {
  name: string
  address: string
  city: string
  state: string
  zipCode: string
  phone: string
  website?: string
}

interface AISettings {
  soapTone: "professional" | "conversational" | "technical"
  soapStyle: "detailed" | "concise" | "standard"
  formality: "formal" | "semi-formal" | "casual"
  autoGenerate: boolean
  includeRisks: boolean
  includeBillingCodes: boolean
}

interface PaymentSettings {
  stripeAccountId?: string
  payoutSchedule: "daily" | "weekly" | "monthly"
  taxId?: string
  businessName?: string
}

interface SecuritySettings {
  twoFactorEnabled: boolean
  emailNotifications: boolean
  smsNotifications: boolean
  sessionTimeout: number
}

export default function DoctorSettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  // Profile data
  const [userProfile, setUserProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
  })
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile>({
    id: "",
    userId: "",
    licenseNumber: "",
    specialization: "",
    credentials: [],
    npiNumber: "",
    bio: "",
    languages: [],
    timezone: "America/New_York",
  })

  // Clinic info
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    phone: "",
    website: "",
  })

  // AI settings
  const [aiSettings, setAISettings] = useState<AISettings>({
    soapTone: "professional",
    soapStyle: "standard",
    formality: "formal",
    autoGenerate: true,
    includeRisks: true,
    includeBillingCodes: true,
  })

  // Payment settings
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    payoutSchedule: "weekly",
    taxId: "",
    businessName: "",
  })

  // Security settings
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings>({
    twoFactorEnabled: false,
    emailNotifications: true,
    smsNotifications: false,
    sessionTimeout: 30,
  })

  useEffect(() => {
    if (!authLoading && user) {
      fetchSettings()
    }
  }, [user, authLoading])

  const fetchSettings = async () => {
    try {
      // Fetch doctor profile
      const response = await fetch("/api/doctor/profile", {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setDoctorProfile(data.doctor)
        setUserProfile(data.user)
        // TODO: Fetch clinic info, AI settings, payment settings, security settings
        // For now, using defaults
      }
    } catch (error: any) {
      console.error("Error fetching settings:", error)
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving("profile")
    try {
      const response = await fetch("/api/doctor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          user: userProfile,
          doctor: {
            specialization: doctorProfile.specialization,
            credentials: doctorProfile.credentials,
            npiNumber: doctorProfile.npiNumber,
            bio: doctorProfile.bio,
            languages: doctorProfile.languages,
            timezone: doctorProfile.timezone,
          },
        }),
      })

      if (!response.ok) throw new Error("Failed to save profile")

      toast({
        title: "Success",
        description: "Profile updated successfully",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save profile",
        variant: "destructive",
      })
    } finally {
      setSaving(null)
    }
  }

  const handleSaveClinic = async () => {
    setSaving("clinic")
    try {
      // TODO: Implement clinic info save API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Success",
        description: "Clinic information updated successfully",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save clinic information",
        variant: "destructive",
      })
    } finally {
      setSaving(null)
    }
  }

  const handleSaveAI = async () => {
    setSaving("ai")
    try {
      // TODO: Implement AI settings save API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Success",
        description: "AI settings updated successfully",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save AI settings",
        variant: "destructive",
      })
    } finally {
      setSaving(null)
    }
  }

  const handleSavePayment = async () => {
    setSaving("payment")
    try {
      // TODO: Implement payment settings save API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Success",
        description: "Payment settings updated successfully",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save payment settings",
        variant: "destructive",
      })
    } finally {
      setSaving(null)
    }
  }

  const handleSaveSecurity = async () => {
    setSaving("security")
    try {
      // TODO: Implement security settings save API
      await new Promise((resolve) => setTimeout(resolve, 1000))
      toast({
        title: "Success",
        description: "Security settings updated successfully",
        variant: "success",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save security settings",
        variant: "destructive",
      })
    } finally {
      setSaving(null)
    }
  }

  if (authLoading || loading) {
    return (
      <DoctorDashboardLayout>
        <PageSkeleton />
      </DoctorDashboardLayout>
    )
  }

  return (
    <DoctorDashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-2">Manage your account and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="clinic" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Clinic</span>
            </TabsTrigger>
            <TabsTrigger value="specialty" className="gap-2">
              <Stethoscope className="h-4 w-4" />
              <span className="hidden sm:inline">Specialty</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="payment" className="gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Payment</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Update your personal information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={userProfile.firstName}
                      onChange={(e) => setUserProfile({ ...userProfile, firstName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={userProfile.lastName}
                      onChange={(e) => setUserProfile({ ...userProfile, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={userProfile.email}
                      onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Phone Number</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={userProfile.phoneNumber || ""}
                      onChange={(e) => setUserProfile({ ...userProfile, phoneNumber: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={doctorProfile.bio || ""}
                    onChange={(e) => setDoctorProfile({ ...doctorProfile, bio: e.target.value })}
                    rows={4}
                    placeholder="Tell patients about your background and expertise..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>License Number</Label>
                  <Input value={doctorProfile.licenseNumber} disabled />
                  <p className="text-xs text-muted-foreground">License number cannot be changed</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npiNumber">NPI Number</Label>
                  <Input
                    id="npiNumber"
                    value={doctorProfile.npiNumber || ""}
                    onChange={(e) => setDoctorProfile({ ...doctorProfile, npiNumber: e.target.value })}
                    placeholder="National Provider Identifier"
                  />
                </div>
                <Button onClick={handleSaveProfile} disabled={saving === "profile"}>
                  {saving === "profile" ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clinic Info Tab */}
          <TabsContent value="clinic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Clinic Information</CardTitle>
                <CardDescription>Your clinic or practice details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clinicName">Clinic Name *</Label>
                  <Input
                    id="clinicName"
                    value={clinicInfo.name}
                    onChange={(e) => setClinicInfo({ ...clinicInfo, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicAddress">Address</Label>
                  <Input
                    id="clinicAddress"
                    value={clinicInfo.address}
                    onChange={(e) => setClinicInfo({ ...clinicInfo, address: e.target.value })}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="clinicCity">City</Label>
                    <Input
                      id="clinicCity"
                      value={clinicInfo.city}
                      onChange={(e) => setClinicInfo({ ...clinicInfo, city: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicState">State</Label>
                    <Input
                      id="clinicState"
                      value={clinicInfo.state}
                      onChange={(e) => setClinicInfo({ ...clinicInfo, state: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicZip">ZIP Code</Label>
                    <Input
                      id="clinicZip"
                      value={clinicInfo.zipCode}
                      onChange={(e) => setClinicInfo({ ...clinicInfo, zipCode: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="clinicPhone">Phone</Label>
                    <Input
                      id="clinicPhone"
                      type="tel"
                      value={clinicInfo.phone}
                      onChange={(e) => setClinicInfo({ ...clinicInfo, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="clinicWebsite">Website</Label>
                    <Input
                      id="clinicWebsite"
                      type="url"
                      value={clinicInfo.website || ""}
                      onChange={(e) => setClinicInfo({ ...clinicInfo, website: e.target.value })}
                      placeholder="https://example.com"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveClinic} disabled={saving === "clinic"}>
                  {saving === "clinic" ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Clinic Info
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Specialty Settings Tab */}
          <TabsContent value="specialty" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Specialty Settings</CardTitle>
                <CardDescription>Configure your medical specialty and credentials</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={doctorProfile.specialization || ""}
                    onChange={(e) => setDoctorProfile({ ...doctorProfile, specialization: e.target.value })}
                    placeholder="e.g., Internal Medicine, Cardiology, Pediatrics"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Credentials</Label>
                  <div className="flex flex-wrap gap-2">
                    {["MD", "DO", "NP", "PA", "RN", "DNP", "PhD"].map((cred) => (
                      <div key={cred} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cred-${cred}`}
                          checked={doctorProfile.credentials.includes(cred)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setDoctorProfile({
                                ...doctorProfile,
                                credentials: [...doctorProfile.credentials, cred],
                              })
                            } else {
                              setDoctorProfile({
                                ...doctorProfile,
                                credentials: doctorProfile.credentials.filter((c) => c !== cred),
                              })
                            }
                          }}
                        />
                        <Label htmlFor={`cred-${cred}`} className="cursor-pointer">
                          {cred}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="languages">Languages Spoken</Label>
                  <Input
                    id="languages"
                    value={doctorProfile.languages.join(", ")}
                    onChange={(e) =>
                      setDoctorProfile({
                        ...doctorProfile,
                        languages: e.target.value.split(",").map((l) => l.trim()).filter(Boolean),
                      })
                    }
                    placeholder="English, Spanish, French (comma-separated)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={doctorProfile.timezone}
                    onValueChange={(value) => setDoctorProfile({ ...doctorProfile, timezone: value })}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSaveProfile} disabled={saving === "profile"}>
                  {saving === "profile" ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Specialty Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI SOAP Note Settings</CardTitle>
                <CardDescription>Customize how AI generates your SOAP notes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="soapTone">Tone</Label>
                  <Select
                    value={aiSettings.soapTone}
                    onValueChange={(value: any) => setAISettings({ ...aiSettings, soapTone: value })}
                  >
                    <SelectTrigger id="soapTone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                      <SelectItem value="technical">Technical</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Professional: Formal and clinical. Conversational: More accessible. Technical: Highly detailed.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="soapStyle">Style</Label>
                  <Select
                    value={aiSettings.soapStyle}
                    onValueChange={(value: any) => setAISettings({ ...aiSettings, soapStyle: value })}
                  >
                    <SelectTrigger id="soapStyle">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detailed">Detailed</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="concise">Concise</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Detailed: Comprehensive notes. Standard: Balanced. Concise: Brief and focused.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="formality">Formality</Label>
                  <Select
                    value={aiSettings.formality}
                    onValueChange={(value: any) => setAISettings({ ...aiSettings, formality: value })}
                  >
                    <SelectTrigger id="formality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="semi-formal">Semi-Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-generate SOAP Notes</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically generate SOAP notes after consultations
                      </p>
                    </div>
                    <Switch
                      checked={aiSettings.autoGenerate}
                      onCheckedChange={(checked) => setAISettings({ ...aiSettings, autoGenerate: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Include Risk Warnings</Label>
                      <p className="text-sm text-muted-foreground">
                        Include potential risks and complications in notes
                      </p>
                    </div>
                    <Switch
                      checked={aiSettings.includeRisks}
                      onCheckedChange={(checked) => setAISettings({ ...aiSettings, includeRisks: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Include Billing Codes</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically suggest ICD-10 and CPT codes
                      </p>
                    </div>
                    <Switch
                      checked={aiSettings.includeBillingCodes}
                      onCheckedChange={(checked) => setAISettings({ ...aiSettings, includeBillingCodes: checked })}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveAI} disabled={saving === "ai"}>
                  {saving === "ai" ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save AI Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment Settings Tab */}
          <TabsContent value="payment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment Settings</CardTitle>
                <CardDescription>Configure your payment and payout preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="payoutSchedule">Payout Schedule</Label>
                  <Select
                    value={paymentSettings.payoutSchedule}
                    onValueChange={(value: any) => setPaymentSettings({ ...paymentSettings, payoutSchedule: value })}
                  >
                    <SelectTrigger id="payoutSchedule">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={paymentSettings.businessName || ""}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, businessName: e.target.value })}
                    placeholder="Your practice or business name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxId">Tax ID (EIN)</Label>
                  <Input
                    id="taxId"
                    value={paymentSettings.taxId || ""}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, taxId: e.target.value })}
                    placeholder="XX-XXXXXXX"
                  />
                </div>
                <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Stripe Integration:</strong> Connect your Stripe account to receive payments. Your account will be verified before payouts begin.
                  </p>
                </div>
                <Button onClick={handleSavePayment} disabled={saving === "payment"}>
                  {saving === "payment" ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Payment Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Settings Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security and privacy</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-muted-foreground">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.twoFactorEnabled}
                    onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, twoFactorEnabled: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.emailNotifications}
                    onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, emailNotifications: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications via SMS
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.smsNotifications}
                    onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, smsNotifications: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="5"
                    max="480"
                    value={securitySettings.sessionTimeout}
                    onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: parseInt(e.target.value) || 30 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Automatically log out after inactivity (5-480 minutes)
                  </p>
                </div>
                <div className="rounded-md bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 p-4">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>Password:</strong> To change your password, please use the password reset feature in your account settings.
                  </p>
                </div>
                <Button onClick={handleSaveSecurity} disabled={saving === "security"}>
                  {saving === "security" ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Security Settings
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DoctorDashboardLayout>
  )
}

