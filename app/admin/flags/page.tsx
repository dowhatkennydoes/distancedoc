"use client"

import * as React from "react"
import { AdminLayout } from "@/components/admin/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Flag,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ui/use-toast"
import { format } from "date-fns"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface FeatureFlag {
  id: string
  key: string
  enabled: boolean
  description: string
  category: string
  defaultValue?: boolean
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  updatedBy?: string
}

interface FeatureFlagsResponse {
  flags: FeatureFlag[]
  flagsByCategory: Record<string, FeatureFlag[]>
}

export default function AdminFeatureFlagsPage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(true)
  const [flags, setFlags] = React.useState<FeatureFlag[]>([])
  const [flagsByCategory, setFlagsByCategory] = React.useState<Record<string, FeatureFlag[]>>({})
  const [updatingFlags, setUpdatingFlags] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)

  const fetchFlags = React.useCallback(async () => {
    if (!user || user.role !== "admin") return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/feature-flags", {
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error("Failed to fetch feature flags")
      }

      const data: FeatureFlagsResponse = await response.json()
      setFlags(data.flags || [])
      setFlagsByCategory(data.flagsByCategory || {})
    } catch (err: any) {
      console.error("Failed to fetch feature flags:", err)
      setError(err.message || "Failed to fetch feature flags")
      toast({
        title: "Error",
        description: "Failed to load feature flags. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [user, toast])

  React.useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  const updateFlag = React.useCallback(
    async (key: string, enabled: boolean, flag: FeatureFlag) => {
      // Optimistic update
      setFlags((prevFlags) =>
        prevFlags.map((f) => (f.key === key ? { ...f, enabled } : f))
      )
      setFlagsByCategory((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((category) => {
          updated[category] = updated[category].map((f) =>
            f.key === key ? { ...f, enabled } : f
          )
        })
        return updated
      })

      setUpdatingFlags((prev) => new Set(prev).add(key))

      try {
        const response = await fetch(`/api/admin/feature-flags/${key}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ enabled }),
        })

        if (!response.ok) {
          throw new Error("Failed to update feature flag")
        }

        const data = await response.json()
        const updatedFlag = data.flag

        // Update with server response
        setFlags((prevFlags) =>
          prevFlags.map((f) => (f.key === key ? updatedFlag : f))
        )
        setFlagsByCategory((prev) => {
          const updated = { ...prev }
          Object.keys(updated).forEach((category) => {
            updated[category] = updated[category].map((f) =>
              f.key === key ? updatedFlag : f
            )
          })
          return updated
        })

        toast({
          title: "Success",
          description: `Feature "${flag.description}" ${enabled ? "enabled" : "disabled"}`,
        })
      } catch (err: any) {
        // Revert optimistic update
        setFlags((prevFlags) =>
          prevFlags.map((f) => (f.key === key ? flag : f))
        )
        setFlagsByCategory((prev) => {
          const updated = { ...prev }
          Object.keys(updated).forEach((category) => {
            updated[category] = updated[category].map((f) =>
              f.key === key ? flag : f
            )
          })
          return updated
        })

        console.error("Failed to update feature flag:", err)
        toast({
          title: "Error",
          description: err.message || "Failed to update feature flag. Please try again.",
          variant: "destructive",
        })
      } finally {
        setUpdatingFlags((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
      }
    },
    [toast]
  )

  const categories = Object.keys(flagsByCategory).sort()

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-muted-foreground">Loading feature flags...</div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Feature Flags</h1>
            <p className="text-muted-foreground mt-1">
              Manage feature toggles and A/B testing
            </p>
          </div>
          <Button variant="outline" onClick={fetchFlags} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Feature Flags by Category */}
        {categories.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center h-[400px]">
              <div className="text-center">
                <Flag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No feature flags found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Feature flags will be initialized on first load
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          categories.map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>
                  {flagsByCategory[category].length} feature flag(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {flagsByCategory[category].map((flag) => {
                    const isUpdating = updatingFlags.has(flag.key)
                    return (
                      <div
                        key={flag.key}
                        className="flex items-start justify-between gap-4 p-4 border rounded-lg"
                      >
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={flag.key} className="text-base font-semibold">
                              {flag.description}
                            </Label>
                            {flag.enabled ? (
                              <Badge variant="default" className="gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Enabled
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="gap-1">
                                <XCircle className="h-3 w-3" />
                                Disabled
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="font-mono text-xs">{flag.key}</span>
                            {flag.updatedAt && (
                              <span>
                                Last updated: {format(new Date(flag.updatedAt), "MMM d, yyyy HH:mm")}
                              </span>
                            )}
                          </div>
                          {flag.metadata && Object.keys(flag.metadata).length > 0 && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <p className="font-semibold mb-1">Metadata:</p>
                              <pre className="text-xs">
                                {JSON.stringify(flag.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {isUpdating && (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          )}
                          <Switch
                            id={flag.key}
                            checked={flag.enabled}
                            onCheckedChange={(enabled) => updateFlag(flag.key, enabled, flag)}
                            disabled={isUpdating}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {/* Info Alert */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Feature Flags</AlertTitle>
          <AlertDescription>
            Feature flags allow you to enable or disable features without deploying new code.
            Changes take effect immediately. Use optimistic updates for instant UI feedback.
          </AlertDescription>
        </Alert>
      </div>
    </AdminLayout>
  )
}

