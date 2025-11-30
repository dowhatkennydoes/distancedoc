/**
 * PHI-Safe Event Logging Utilities
 * 
 * HIPAA-compliant event logging that:
 * - Does NOT log PHI (Protected Health Information)
 * - Only logs safe metadata (userId, action, timestamp, IP)
 * - Automatically masks sensitive fields
 * - Stores logs in Firestore with restricted IAM permissions
 * 
 * Events logged:
 * - Login success/failure
 * - Unauthorized access attempts
 * - API rate limit violations
 * - Consultation viewing
 * - SOAP note editing
 * - File downloads
 */

import { getFirestore } from '@/lib/gcp/gcp-firestore'
import { Firestore } from '@google-cloud/firestore'
import { redactPHI } from './sanitize'
import { v4 as uuidv4 } from 'uuid'

/**
 * Event types for audit logging
 */
export enum EventType {
  // Authentication events
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  LOGOUT = 'LOGOUT',
  
  // Authorization events
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
  RATE_LIMIT_VIOLATION = 'RATE_LIMIT_VIOLATION',
  
  // Clinical events
  CONSULTATION_VIEW = 'CONSULTATION_VIEW',
  SOAP_NOTE_VIEW = 'SOAP_NOTE_VIEW',
  SOAP_NOTE_EDIT = 'SOAP_NOTE_EDIT',
  SOAP_NOTE_CREATE = 'SOAP_NOTE_CREATE',
  
  // File events
  FILE_DOWNLOAD = 'FILE_DOWNLOAD',
  FILE_UPLOAD = 'FILE_UPLOAD',
  FILE_DELETE = 'FILE_DELETE',
  
  // Patient data events
  PATIENT_VIEW = 'PATIENT_VIEW',
  PATIENT_EDIT = 'PATIENT_EDIT',
  
  // Appointment events
  APPOINTMENT_VIEW = 'APPOINTMENT_VIEW',
  APPOINTMENT_CREATE = 'APPOINTMENT_CREATE',
  APPOINTMENT_EDIT = 'APPOINTMENT_EDIT',
  APPOINTMENT_DELETE = 'APPOINTMENT_DELETE',
}

/**
 * Safe metadata that can be logged (no PHI)
 */
interface SafeMetadata {
  userId?: string
  userRole?: string
  clinicId?: string
  action: string
  resourceType?: string
  resourceId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
  timestamp: string
  success?: boolean
  errorCode?: string
  // Additional safe fields (no PHI)
  [key: string]: string | number | boolean | undefined
}

/**
 * PHI fields that must be redacted
 */
const PHI_FIELDS = [
  'email',
  'phone',
  'ssn',
  'dateOfBirth',
  'address',
  'name',
  'firstName',
  'lastName',
  'fullName',
  'medicalRecordNumber',
  'insuranceNumber',
  'diagnosis',
  'symptoms',
  'notes',
  'transcript',
  'audio',
  'fileContent',
  'patientName',
  'doctorName',
  'consultationNotes',
  'soapNote',
  'subjective',
  'objective',
  'assessment',
  'plan',
]

/**
 * Automatically mask PHI from metadata
 */
function maskPHI(metadata: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(metadata)) {
    const lowerKey = key.toLowerCase()
    
    // Check if key indicates PHI
    const isPHIField = PHI_FIELDS.some(phiField => 
      lowerKey.includes(phiField.toLowerCase())
    )
    
    if (isPHIField) {
      // Mask PHI fields
      masked[key] = '[PHI_REDACTED]'
    } else if (typeof value === 'string') {
      // Redact PHI patterns from string values
      masked[key] = redactPHI(value)
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively mask nested objects
      masked[key] = maskPHI(value as Record<string, any>)
    } else if (Array.isArray(value)) {
      // Mask array items
      masked[key] = value.map(item => 
        typeof item === 'string' 
          ? redactPHI(item)
          : typeof item === 'object' && item !== null
          ? maskPHI(item as Record<string, any>)
          : item
      )
    } else {
      // Safe to include as-is
      masked[key] = value
    }
  }
  
  return masked
}

/**
 * Extract IP address from request
 */
function getIPAddress(request?: Request): string | undefined {
  if (!request) return undefined
  
  // Check headers for real IP (behind proxy)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  return (
    forwarded?.split(',')[0].trim() ||
    realIP ||
    cfConnectingIP ||
    undefined
  )
}

/**
 * Extract user agent from request
 */
function getUserAgent(request?: Request): string | undefined {
  if (!request) return undefined
  return request.headers.get('user-agent') || undefined
}

/**
 * Create safe metadata object (no PHI)
 */
function createSafeMetadata(
  eventName: EventType,
  metadata: Record<string, any> = {},
  userId?: string,
  request?: Request,
  requestId?: string
): SafeMetadata {
  const safe: SafeMetadata = {
    action: eventName,
    timestamp: new Date().toISOString(),
    requestId: requestId || uuidv4(),
  }
  
  // Add user info (safe)
  if (userId) {
    safe.userId = userId
  }
  
  // Add request info (safe)
  if (request) {
    safe.ipAddress = getIPAddress(request)
    safe.userAgent = getUserAgent(request)
  }
  
  // Add metadata (masked)
  const maskedMetadata = maskPHI(metadata)
  Object.assign(safe, maskedMetadata)
  
  return safe
}

/**
 * Log event to Firestore
 * Non-blocking (fire-and-forget) to avoid slowing down request responses
 * 
 * @param eventName - Event type
 * @param metadata - Event metadata (will be masked for PHI)
 * @param userId - User ID (optional)
 * @param request - Request object (optional, for IP/userAgent)
 * @param requestId - Request ID (optional)
 */
export async function logEvent(
  eventName: EventType,
  metadata: Record<string, any> = {},
  userId?: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  // Fire-and-forget: don't await the logging operation
  // This prevents logging from blocking request responses
  const loggingPromise = (async () => {
    try {
      const safeMetadata = createSafeMetadata(eventName, metadata, userId, request, requestId)
      
      // Store in Firestore audit_logs collection
      const firestore = getFirestore()
      const auditLogsRef = firestore.collection('audit_logs')
      
      await auditLogsRef.add({
        ...safeMetadata,
        createdAt: Firestore.FieldValue.serverTimestamp(),
      })
      
      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[EVENT] ${eventName}:`, JSON.stringify(safeMetadata, null, 2))
      }
    } catch (error) {
      // Don't throw - logging failures shouldn't break the app
      console.error('Failed to log event:', error)
    }
  })()

  // In non-critical paths, we can still return the promise for awaiting if needed
  // But in login paths, this will be fire-and-forget
  return loggingPromise
}

/**
 * Log login success
 */
export async function logLoginSuccess(
  userId: string,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.LOGIN_SUCCESS,
    {
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log login failure
 */
export async function logLoginFailure(
  email: string, // Will be masked
  reason: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.LOGIN_FAILURE,
    {
      // Email will be automatically masked
      attemptedEmail: email,
      reason,
      success: false,
    },
    undefined, // No userId for failed login
    request,
    requestId
  )
}

/**
 * Log unauthorized access attempt
 */
export async function logUnauthorizedAccess(
  userId: string | undefined,
  resourceType: string,
  resourceId: string,
  reason: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.UNAUTHORIZED_ACCESS,
    {
      resourceType,
      resourceId,
      reason,
      success: false,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log rate limit violation
 */
export async function logRateLimitViolation(
  userId: string | undefined,
  endpoint: string,
  limit: number,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.RATE_LIMIT_VIOLATION,
    {
      endpoint,
      limit,
      success: false,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log consultation view
 */
export async function logConsultationView(
  userId: string,
  consultationId: string,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.CONSULTATION_VIEW,
    {
      resourceType: 'consultation',
      resourceId: consultationId,
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log SOAP note view
 */
export async function logSOAPNoteView(
  userId: string,
  noteId: string,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.SOAP_NOTE_VIEW,
    {
      resourceType: 'soap_note',
      resourceId: noteId,
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log SOAP note edit
 */
export async function logSOAPNoteEdit(
  userId: string,
  noteId: string,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.SOAP_NOTE_EDIT,
    {
      resourceType: 'soap_note',
      resourceId: noteId,
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log SOAP note creation
 */
export async function logSOAPNoteCreate(
  userId: string,
  noteId: string,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.SOAP_NOTE_CREATE,
    {
      resourceType: 'soap_note',
      resourceId: noteId,
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log file download
 */
export async function logFileDownload(
  userId: string,
  fileId: string,
  fileName: string, // Will be masked if contains PHI
  fileType: string,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.FILE_DOWNLOAD,
    {
      resourceType: 'file',
      resourceId: fileId,
      fileName, // Will be automatically masked
      fileType,
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Log file upload
 */
export async function logFileUpload(
  userId: string,
  fileId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  userRole: string,
  request?: Request,
  requestId?: string
): Promise<void> {
  await logEvent(
    EventType.FILE_UPLOAD,
    {
      resourceType: 'file',
      resourceId: fileId,
      fileName, // Will be automatically masked
      fileType,
      fileSize,
      userRole,
      success: true,
    },
    userId,
    request,
    requestId
  )
}

/**
 * Helper to get request from NextRequest
 */
export function getRequestFromNextRequest(nextRequest: any): Request | undefined {
  // NextRequest extends Request, so we can use it directly
  return nextRequest as Request
}

