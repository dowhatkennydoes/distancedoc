"use client"

/**
 * Admin Debug Page
 * 
 * Requirements:
 * 1. Page must load even if no user is logged in
 * 2. Never error on null state
 * 3. Only show debug data in dev environment
 * 
 * Shows:
 * - authenticated
 * - user
 * - role
 * - clinicId
 * - token age
 * - session expiration
 */

import * as React from "react"
import { useAuth } from "@/contexts/AuthContext"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"

interface SessionInfo {
  expiresAt: number | null
  expiresIn: number | null
  tokenType: string | null
  accessToken: string | null
  refreshToken: string | null
}

/**
 * Check if running in development environment
 */
function isDevelopment(): boolean {
  return process.env.NODE_ENV === "development"
}

/**
 * Format token age (time since token was issued)
 */
function formatTokenAge(issuedAt: number | null | undefined): string {
  if (!issuedAt) return "Unknown"
  
  try {
    const issuedDate = new Date(issuedAt * 1000)
    return formatDistanceToNow(issuedDate, { addSuffix: true })
  } catch {
    return "Invalid"
  }
}

/**
 * Format time until expiration
 */
function formatTimeUntilExpiration(expiresAt: number | null | undefined): string {
  if (!expiresAt) return "Unknown"
  
  try {
    const expirationDate = new Date(expiresAt * 1000)
    const now = new Date()
    
    if (expirationDate < now) {
      return `Expired ${formatDistanceToNow(expirationDate, { addSuffix: true })}`
    }
    
    return `Expires ${formatDistanceToNow(expirationDate, { addSuffix: true })}`
  } catch {
    return "Invalid"
  }
}

/**
 * Format expiration date/time
 */
function formatExpirationDate(expiresAt: number | null | undefined): string {
  if (!expiresAt) return "N/A"
  
  try {
    const expirationDate = new Date(expiresAt * 1000)
    return format(expirationDate, "PPpp")
  } catch {
    return "Invalid"
  }
}

export default function AdminDebugPage() {
  const { user, authenticated, loading, authReady, error } = useAuth()
  const [sessionInfo, setSessionInfo] = React.useState<SessionInfo | null>(null)
  const [sessionLoading, setSessionLoading] = React.useState(true)
  const [sessionError, setSessionError] = React.useState<string | null>(null)
  const [mounted, setMounted] = React.useState(false)

  // Track mounted state for hydration safety
  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch session info from Supabase
  React.useEffect(() => {
    if (!mounted) return

    async function fetchSessionInfo() {
      try {
        setSessionLoading(true)
        setSessionError(null)
        
        const supabase = createClient()
        const { data, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          setSessionError(sessionError.message || "Failed to get session")
          setSessionInfo(null)
          return
        }
        
        if (!data.session) {
          setSessionInfo(null)
          return
        }
        
        setSessionInfo({
          expiresAt: data.session.expires_at || null,
          expiresIn: data.session.expires_in || null,
          tokenType: data.session.token_type || null,
          accessToken: data.session.access_token ? `${data.session.access_token.substring(0, 20)}...` : null,
          refreshToken: data.session.refresh_token ? `${data.session.refresh_token.substring(0, 20)}...` : null,
        })
      } catch (err: any) {
        // Requirement 2: Never error on null state
        setSessionError(err?.message || "Unknown error")
        setSessionInfo(null)
      } finally {
        setSessionLoading(false)
      }
    }

    fetchSessionInfo()
  }, [mounted, authenticated])

  // Requirement 3: Only show debug data in dev environment
  if (!isDevelopment()) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Debug Page</CardTitle>
            <CardDescription>Debug information is only available in development mode</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This page is disabled in production for security reasons.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Requirement 1: Page must load even if no user is logged in
  // Requirement 2: Never error on null state
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>Admin Debug Information</CardTitle>
          <CardDescription>
            Authentication and session debug data (Development Only)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Authentication State */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Authentication State</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Authenticated:</span>
                <Badge variant={authenticated ? "default" : "secondary"} className="ml-2">
                  {authenticated ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Loading:</span>
                <Badge variant={loading ? "default" : "secondary"} className="ml-2">
                  {loading ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Auth Ready:</span>
                <Badge variant={authReady ? "default" : "secondary"} className="ml-2">
                  {authReady ? "Yes" : "No"}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Error:</span>
                <span className="ml-2 text-muted-foreground">
                  {error || "None"}
                </span>
              </div>
            </div>
          </div>

          {/* User Information */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">User Information</h3>
            {user ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">ID:</span>
                  <span className="ml-2 font-mono text-xs">{user.id}</span>
                </div>
                <div>
                  <span className="font-medium">Email:</span>
                  <span className="ml-2">{user.email}</span>
                </div>
                <div>
                  <span className="font-medium">Role:</span>
                  <Badge variant="outline" className="ml-2">
                    {user.role || "Unknown"}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium">Clinic ID:</span>
                  <span className="ml-2 font-mono text-xs">
                    {user.clinicId || "Not set"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Email Verified:</span>
                  <Badge variant={user.emailVerified ? "default" : "secondary"} className="ml-2">
                    {user.emailVerified ? "Yes" : "No"}
                  </Badge>
                </div>
                {user.metadata && (
                  <div>
                    <span className="font-medium">Metadata:</span>
                    <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(user.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No user logged in</p>
            )}
          </div>

          {/* Session Information */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Session Information</h3>
            {sessionLoading ? (
              <p className="text-muted-foreground text-sm">Loading session...</p>
            ) : sessionError ? (
              <div>
                <p className="text-destructive text-sm mb-2">Error: {sessionError}</p>
                <p className="text-muted-foreground text-sm">No session available</p>
              </div>
            ) : sessionInfo ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Expiration Date:</span>
                  <span className="ml-2">
                    {formatExpirationDate(sessionInfo.expiresAt)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Time Until Expiration:</span>
                  <span className="ml-2">
                    {formatTimeUntilExpiration(sessionInfo.expiresAt)}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Expires In (seconds):</span>
                  <span className="ml-2">
                    {sessionInfo.expiresIn ? `${sessionInfo.expiresIn}s` : "Unknown"}
                  </span>
                </div>
                {sessionInfo.expiresAt && (
                  <div>
                    <span className="font-medium">Token Age:</span>
                    <span className="ml-2">
                      {formatTokenAge(sessionInfo.expiresAt - (sessionInfo.expiresIn || 3600))}
                    </span>
                  </div>
                )}
                <div>
                  <span className="font-medium">Token Type:</span>
                  <span className="ml-2">
                    {sessionInfo.tokenType || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Access Token (preview):</span>
                  <span className="ml-2 font-mono text-xs">
                    {sessionInfo.accessToken || "Not available"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Refresh Token (preview):</span>
                  <span className="ml-2 font-mono text-xs">
                    {sessionInfo.refreshToken || "Not available"}
                  </span>
                </div>
                {sessionInfo.expiresAt && (
                  <div>
                    <span className="font-medium">Raw Expiration (Unix):</span>
                    <span className="ml-2 font-mono text-xs">
                      {sessionInfo.expiresAt}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No session available</p>
            )}
          </div>

          {/* Raw Data (for debugging) */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Raw Data</h3>
            <div className="space-y-4">
              <div>
                <span className="font-medium text-sm">User Object:</span>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(user, null, 2) || "null"}
                </pre>
              </div>
              <div>
                <span className="font-medium text-sm">Session Info:</span>
                <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(sessionInfo, null, 2) || "null"}
                </pre>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="space-y-2 pt-4 border-t">
            <h3 className="text-lg font-semibold">Unauth Flow Verification</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={!authenticated && !loading && authReady ? "default" : "secondary"}>
                  {!authenticated && !loading && authReady ? "✓" : "○"}
                </Badge>
                <span>Unauthenticated state detected correctly</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={user === null && !loading ? "default" : "secondary"}>
                  {user === null && !loading ? "✓" : "○"}
                </Badge>
                <span>User is null (not undefined)</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={!sessionInfo && !sessionLoading && !sessionError ? "default" : "secondary"}>
                  {!sessionInfo && !sessionLoading && !sessionError ? "✓" : "○"}
                </Badge>
                <span>No session when unauthenticated</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={error === null || error === "" ? "default" : "secondary"}>
                  {error === null || error === "" ? "✓" : "○"}
                </Badge>
                <span>No errors in unauthenticated state</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

