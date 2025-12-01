"use client"

import * as React from "react"
import { X, Settings, Clock, Stethoscope, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"

interface ClinicSettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  clinicId: string | null
}

interface ClinicSettings {
  defaultVisitDuration: number
  specialtiesEnabled: string[]
  aiNoteTemplates: string[]
}

export function ClinicSettingsDrawer({
  isOpen,
  onClose,
  clinicId,
}: ClinicSettingsDrawerProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [settings, setSettings] = React.useState<ClinicSettings>({
    defaultVisitDuration: 30,
    specialtiesEnabled: [],
    aiNoteTemplates: [],
  })
  const [newSpecialty, setNewSpecialty] = React.useState("")
  const [newTemplate, setNewTemplate] = React.useState("")

  React.useEffect(() => {
    if (isOpen && clinicId) {
      fetchClinicSettings()
    } else {
      setSettings({
        defaultVisitDuration: 30,
        specialtiesEnabled: [],
        aiNoteTemplates: [],
      })
    }
  }, [isOpen, clinicId])

  const fetchClinicSettings = async () => {
    if (!clinicId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}`, {
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        setSettings({
          defaultVisitDuration: data.settings?.defaultVisitDuration || 30,
          specialtiesEnabled: data.settings?.specialtiesEnabled || [],
          aiNoteTemplates: data.settings?.aiNoteTemplates || [],
        })
      }
    } catch (error) {
      console.error("Failed to fetch clinic settings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!clinicId) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Clinic settings updated successfully",
        })
        onClose()
      } else {
        throw new Error("Failed to update settings")
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const addSpecialty = () => {
    if (newSpecialty.trim() && !settings.specialtiesEnabled.includes(newSpecialty.trim())) {
      setSettings((prev) => ({
        ...prev,
        specialtiesEnabled: [...prev.specialtiesEnabled, newSpecialty.trim()],
      }))
      setNewSpecialty("")
    }
  }

  const removeSpecialty = (specialty: string) => {
    setSettings((prev) => ({
      ...prev,
      specialtiesEnabled: prev.specialtiesEnabled.filter((s) => s !== specialty),
    }))
  }

  const addTemplate = () => {
    if (newTemplate.trim() && !settings.aiNoteTemplates.includes(newTemplate.trim())) {
      setSettings((prev) => ({
        ...prev,
        aiNoteTemplates: [...prev.aiNoteTemplates, newTemplate.trim()],
      }))
      setNewTemplate("")
    }
  }

  const removeTemplate = (template: string) => {
    setSettings((prev) => ({
      ...prev,
      aiNoteTemplates: prev.aiNoteTemplates.filter((t) => t !== template),
    }))
  }

  if (!isOpen) return null

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 z-50 h-full w-full max-w-2xl bg-background border-l shadow-lg transition-transform duration-300 ease-in-out overflow-hidden flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4 sm:p-6">
          <div>
            <h2 id="drawer-title" className="text-xl font-semibold">
              Clinic Settings
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure clinic-level settings and preferences
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-9 w-9"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading settings...</div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Default Visit Duration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Default Visit Duration
                  </CardTitle>
                  <CardDescription>
                    Default appointment duration in minutes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)</Label>
                    <Input
                      id="duration"
                      type="number"
                      min="15"
                      max="120"
                      step="15"
                      value={settings.defaultVisitDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          defaultVisitDuration: parseInt(e.target.value) || 30,
                        }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Recommended: 15, 30, 45, or 60 minutes
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Enabled Specialties */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Stethoscope className="h-5 w-5" />
                    Enabled Specialties
                  </CardTitle>
                  <CardDescription>
                    Medical specialties available at this clinic
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add specialty (e.g., Cardiology)"
                        value={newSpecialty}
                        onChange={(e) => setNewSpecialty(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addSpecialty()
                          }
                        }}
                      />
                      <Button onClick={addSpecialty} type="button">
                        Add
                      </Button>
                    </div>
                    {settings.specialtiesEnabled.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {settings.specialtiesEnabled.map((specialty) => (
                          <Badge
                            key={specialty}
                            variant="secondary"
                            className="flex items-center gap-1"
                          >
                            {specialty}
                            <button
                              onClick={() => removeSpecialty(specialty)}
                              className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                              aria-label={`Remove ${specialty}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No specialties added yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* AI Note Templates */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    AI Note Templates
                  </CardTitle>
                  <CardDescription>
                    Template prompts for AI-generated SOAP notes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Template name (e.g., General Visit)"
                        value={newTemplate}
                        onChange={(e) => setNewTemplate(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            addTemplate()
                          }
                        }}
                      />
                      <Button onClick={addTemplate} type="button">
                        Add
                      </Button>
                    </div>
                    {settings.aiNoteTemplates.length > 0 ? (
                      <div className="space-y-2">
                        {settings.aiNoteTemplates.map((template) => (
                          <div
                            key={template}
                            className="flex items-center justify-between p-3 border rounded"
                          >
                            <span className="text-sm font-medium">{template}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTemplate(template)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No templates added yet
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 sm:p-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </>
  )
}

