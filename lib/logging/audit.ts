/**
 * PHI-Safe Audit Logging Module
 * 
 * HIPAA-compliant audit logging that NEVER logs PHI or patient medical details.
 * Only logs metadata: userId, clinicId, action, resourceType, resourceId, IP, timestamp.
 * 
 * Rules:
 * - NEVER log PHI (names, addresses, SSN, DOB, medical conditions, etc.)
 * - NEVER log patient medical details (symptoms, diagnoses, medications, etc.)
 * - ONLY log metadata (IDs, actions, timestamps, IP addresses)
 * - All sensitive data must be redacted or excluded
 */

import { logInfo } from '@/lib/security/logging'

/**
 * Audit log entry interface - PHI-safe structure
 * 
 * Only contains metadata, never PHI:
 * - userId: User identifier (not PHI)
 * - clinicId: Clinic identifier (not PHI)
 * - action: Action performed (e.g., "VIEW_PATIENT_CHART")
 * - resourceType: Type of resource accessed (e.g., "patient", "consultation")
 * - resourceId: Resource identifier (not PHI)
 * - ip: IP address (not PHI)
 * - timestamp: When the action occurred
 * - userAgent: Browser/client identifier (optional)
 * - requestId: Request trace identifier (optional)
 */
export interface AuditLogEntry {
  userId: string
  clinicId: string
  action: string
  resourceType: string
  resourceId: string
  ip: string
  timestamp: Date
  userAgent?: string
  requestId?: string
  success?: boolean
  metadata?: Record<string, string | number | boolean> // Only non-PHI metadata
}

/**
 * PHI-safe metadata keys that are safe to log
 * These are identifiers and metadata, not medical information
 */
const SAFE_METADATA_KEYS = new Set([
  'fileSize',
  'fileType',
  'category',
  'duration',
  'method',
  'statusCode',
  'count',
  'model',
  'version',
])

/**
 * Sanitize metadata to ensure no PHI is included
 * Removes any keys that might contain PHI
 */
function sanitizeMetadata(metadata?: Record<string, any>): Record<string, string | number | boolean> {
  if (!metadata) {
    return {}
  }

  const sanitized: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(metadata)) {
    // Only include safe metadata keys
    if (SAFE_METADATA_KEYS.has(key)) {
      // Only allow primitive types (no objects, arrays, or strings that might contain PHI)
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value
      }
    }
  }

  return sanitized
}

/**
 * Extract IP address from request headers
 * Safely handles various proxy configurations
 */
function extractIP(request?: { headers?: any }): string {
  if (!request?.headers) {
    return 'unknown'
  }

  const forwarded = request.headers.get?.('x-forwarded-for') || request.headers['x-forwarded-for']
  const realIP = request.headers.get?.('x-real-ip') || request.headers['x-real-ip']
  const cfConnectingIP = request.headers.get?.('cf-connecting-ip') || request.headers['cf-connecting-ip']

  if (forwarded) {
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : []
    return ips[0]?.trim() || 'unknown'
  }

  if (realIP) {
    return typeof realIP === 'string' ? realIP : 'unknown'
  }

  if (cfConnectingIP) {
    return typeof cfConnectingIP === 'string' ? cfConnectingIP : 'unknown'
  }

  return 'unknown'
}

/**
 * Extract user agent from request headers
 */
function extractUserAgent(request?: { headers?: any }): string | undefined {
  if (!request?.headers) {
    return undefined
  }

  const userAgent = request.headers.get?.('user-agent') || request.headers['user-agent']
  return typeof userAgent === 'string' ? userAgent : undefined
}

/**
 * Log access to PHI - PHI-safe audit logging
 * 
 * NEVER logs:
 * - Patient names
 * - Medical conditions
 * - Symptoms
 * - Diagnoses
 * - Medications
 * - Transcripts
 * - Clinical notes
 * - Addresses
 * - Dates of birth
 * - Insurance numbers
 * 
 * ONLY logs:
 * - User ID
 * - Clinic ID
 * - Action type
 * - Resource type
 * - Resource ID
 * - IP address
 * - Timestamp
 * - Safe metadata (file size, type, etc.)
 * 
 * @param params - Audit log parameters (all PHI-safe)
 */
export async function logAccess(params: {
  userId: string
  clinicId: string
  action: string
  resourceType: string
  resourceId: string
  ip?: string
  timestamp?: Date
  userAgent?: string
  requestId?: string
  success?: boolean
  metadata?: Record<string, any>
  request?: any // Optional request object for IP/userAgent extraction
}): Promise<void> {
  try {
    // Extract IP and user agent from request if provided
    const ip = params.ip || extractIP(params.request)
    const userAgent = params.userAgent || extractUserAgent(params.request)
    const timestamp = params.timestamp || new Date()

    // Sanitize metadata to ensure no PHI
    const sanitizedMetadata = sanitizeMetadata(params.metadata)

    // Create PHI-safe audit log entry
    const auditEntry: AuditLogEntry = {
      userId: params.userId,
      clinicId: params.clinicId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      ip,
      timestamp,
      userAgent,
      requestId: params.requestId,
      success: params.success !== undefined ? params.success : true,
      metadata: sanitizedMetadata,
    }

    // Store audit log via structured logging system
    // In production, this should be sent to Cloud Logging or Firestore for centralized logging
    // The structured logging system handles PHI redaction and forwarding to Cloud Logging
    // Never fail the request due to audit log failure - audit logging is fire-and-forget

    // Also log via structured logging system
    logInfo(
      `AUDIT: ${auditEntry.action} on ${auditEntry.resourceType}`,
      {
        action: auditEntry.action,
        resourceType: auditEntry.resourceType,
        resourceId: auditEntry.resourceId,
        clinicId: auditEntry.clinicId,
        ip: auditEntry.ip,
        success: auditEntry.success,
        ...sanitizedMetadata,
      },
      auditEntry.userId,
      auditEntry.requestId
    )
  } catch (error) {
    // Never throw errors from audit logging - always fail silently
    // Audit logging should never break the main request flow
    console.error('Audit logging error (non-critical):', error)
  }
}

/**
 * Convenience function for logging patient chart access
 */
export async function logPatientChartAccess(
  userId: string,
  clinicId: string,
  patientId: string,
  ip?: string,
  request?: any,
  requestId?: string
): Promise<void> {
  await logAccess({
    userId,
    clinicId,
    action: 'VIEW_PATIENT_CHART',
    resourceType: 'patient',
    resourceId: patientId,
    ip,
    request,
    requestId,
    success: true,
  })
}

/**
 * Convenience function for logging consultation access
 */
export async function logConsultationAccess(
  userId: string,
  clinicId: string,
  consultationId: string,
  ip?: string,
  request?: any,
  requestId?: string
): Promise<void> {
  await logAccess({
    userId,
    clinicId,
    action: 'VIEW_CONSULTATION',
    resourceType: 'consultation',
    resourceId: consultationId,
    ip,
    request,
    requestId,
    success: true,
  })
}

/**
 * Convenience function for logging file download
 */
export async function logFileDownload(
  userId: string,
  clinicId: string,
  fileId: string,
  metadata?: {
    fileSize?: number
    fileType?: string
    category?: string
  },
  ip?: string,
  request?: any,
  requestId?: string
): Promise<void> {
  await logAccess({
    userId,
    clinicId,
    action: 'DOWNLOAD_FILE',
    resourceType: 'file',
    resourceId: fileId,
    ip,
    request,
    requestId,
    success: true,
    metadata: metadata ? sanitizeMetadata(metadata) : undefined,
  })
}

/**
 * Convenience function for logging file list access
 */
export async function logFileListAccess(
  userId: string,
  clinicId: string,
  patientId: string,
  fileCount?: number,
  ip?: string,
  request?: any,
  requestId?: string
): Promise<void> {
  await logAccess({
    userId,
    clinicId,
    action: 'LIST_PATIENT_FILES',
    resourceType: 'file',
    resourceId: patientId, // Patient ID is the resource identifier
    ip,
    request,
    requestId,
    success: true,
    metadata: fileCount !== undefined ? { count: fileCount } : undefined,
  })
}

/**
 * Convenience function for logging SOAP note generation
 */
export async function logSOAPNoteGeneration(
  userId: string,
  clinicId: string,
  noteId: string,
  metadata?: {
    model?: string
  },
  ip?: string,
  request?: any,
  requestId?: string
): Promise<void> {
  await logAccess({
    userId,
    clinicId,
    action: 'GENERATE_SOAP_NOTE',
    resourceType: 'visit_note',
    resourceId: noteId,
    ip,
    request,
    requestId,
    success: true,
    metadata: metadata ? sanitizeMetadata(metadata) : undefined,
  })
}

/**
 * Convenience function for logging transcript access
 */
export async function logTranscriptAccess(
  userId: string,
  clinicId: string,
  consultationId: string,
  ip?: string,
  request?: any,
  requestId?: string
): Promise<void> {
  await logAccess({
    userId,
    clinicId,
    action: 'ACCESS_VISIT_TRANSCRIPT',
    resourceType: 'consultation',
    resourceId: consultationId,
    ip,
    request,
    requestId,
    success: true,
  })
}

