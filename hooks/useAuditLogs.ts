/**
 * React Hook for Real-Time Audit Logs from Firestore
 * 
 * Uses Firestore client SDK for real-time listeners
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { collection, query, where, orderBy, limit, onSnapshot, QueryConstraint } from "firebase/firestore"
import { getFirestoreClient } from "@/lib/firestore/client"

export interface AuditLog {
  id: string
  userId: string
  clinicId: string
  action: string
  resourceType: string
  resourceId: string
  ip: string
  timestamp: string
  userAgent?: string
  requestId?: string
  success: boolean
  flagged?: boolean
  flaggedReason?: string
  flaggedBy?: string
  flaggedAt?: string
  metadata?: Record<string, any>
  device?: string
}

interface UseAuditLogsOptions {
  userId?: string
  actionType?: string
  resourceType?: string
  status?: "success" | "failure" | "all"
  clinicId?: string
  flagged?: boolean
  limitCount?: number
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  const {
    userId,
    actionType,
    resourceType,
    status,
    clinicId,
    flagged,
    limitCount = 100,
  } = options

  useEffect(() => {
    setLoading(true)
    setError(null)

    try {
      const firestore = getFirestoreClient()
      const auditLogsRef = collection(firestore, "audit_logs")

      // Build query constraints
      const constraints: QueryConstraint[] = []
      
      if (userId) {
        constraints.push(where("userId", "==", userId))
      }
      if (clinicId) {
        constraints.push(where("clinicId", "==", clinicId))
      }
      if (actionType) {
        constraints.push(where("action", "==", actionType))
      }
      if (resourceType) {
        constraints.push(where("resourceType", "==", resourceType))
      }
      if (status && status !== "all") {
        constraints.push(where("success", "==", status === "success"))
      }
      if (flagged !== undefined) {
        constraints.push(where("flagged", "==", flagged))
      }

      constraints.push(orderBy("timestamp", "desc"))
      constraints.push(limit(limitCount))

      const q = query(auditLogsRef, ...constraints)

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const auditLogs: AuditLog[] = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              userId: data.userId || "",
              clinicId: data.clinicId || "",
              action: data.action || "",
              resourceType: data.resourceType || "",
              resourceId: data.resourceId || "",
              ip: data.ip || "unknown",
              timestamp: data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
              userAgent: data.userAgent,
              requestId: data.requestId,
              success: data.success !== undefined ? data.success : true,
              flagged: data.flagged || false,
              flaggedReason: data.flaggedReason,
              flaggedBy: data.flaggedBy,
              flaggedAt: data.flaggedAt?.toDate?.()?.toISOString(),
              metadata: data.metadata || {},
              device: extractDeviceInfo(data.userAgent),
            }
          })
          setLogs(auditLogs)
          setLoading(false)
        },
        (err) => {
          console.error("Error listening to audit logs:", err)
          setError(err)
          setLoading(false)
        }
      )

      unsubscribeRef.current = unsubscribe

      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current()
          unsubscribeRef.current = null
        }
      }
    } catch (err) {
      console.error("Error setting up audit log listener:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
      setLoading(false)
    }
  }, [userId, actionType, resourceType, status, clinicId, flagged, limitCount])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  return { logs, loading, error }
}

function extractDeviceInfo(userAgent?: string): string {
  if (!userAgent) return "Unknown"
  if (userAgent.includes("Mobile")) return "Mobile"
  if (userAgent.includes("Tablet")) return "Tablet"
  return "Desktop"
}

