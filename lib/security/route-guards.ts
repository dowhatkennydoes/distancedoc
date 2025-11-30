/**
 * Route Guard Utilities
 * 
 * Provides utilities for validating route access, IDs, and preventing spoofing
 */

import { NextRequest } from 'next/server'
import { logUnauthorizedAccess, getRequestFromNextRequest } from './event-logging'
import { v4 as uuidv4 } from 'uuid'

/**
 * Validate ID format (CUID, UUID, or alphanumeric)
 */
export function isValidId(id: string | null | undefined): boolean {
  if (!id || typeof id !== 'string') return false
  
  // CUID format: starts with 'c', 25 characters
  const cuidPattern = /^c[a-z0-9]{24}$/
  // UUID format: 8-4-4-4-12 hex characters
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  // Allow alphanumeric with hyphens/underscores (for flexibility)
  const flexiblePattern = /^[a-zA-Z0-9_-]{1,100}$/
  
  return cuidPattern.test(id) || uuidPattern.test(id) || flexiblePattern.test(id)
}

/**
 * Validate route parameter ID
 * Throws error if invalid
 */
export function validateRouteId(id: string | string[] | undefined, paramName: string = 'id'): string {
  const idValue = Array.isArray(id) ? id[0] : id
  
  if (!idValue) {
    throw new Error(`Missing ${paramName}`)
  }
  
  if (!isValidId(idValue)) {
    throw new Error(`Invalid ${paramName} format`)
  }
  
  return idValue
}

/**
 * Validate query parameter ID
 * Returns null if missing, throws if invalid format
 */
export function validateQueryParamId(
  request: NextRequest,
  paramName: string,
  required: boolean = false
): string | null {
  const value = request.nextUrl.searchParams.get(paramName)
  
  if (!value) {
    if (required) {
      throw new Error(`Missing required query parameter: ${paramName}`)
    }
    return null
  }
  
  if (!isValidId(value)) {
    throw new Error(`Invalid ${paramName} format in query parameter`)
  }
  
  return value
}

/**
 * Check for query param spoofing
 */
export function checkQueryParamSpoofing(
  request: NextRequest,
  allowedParams: string[] = []
): { detected: boolean; suspiciousParams: string[] } {
  const suspiciousParams: string[] = []
  const searchParams = request.nextUrl.searchParams
  
  // Common ID parameter names that shouldn't be in query strings
  const sensitiveParams = [
    'patientId',
    'doctorId',
    'userId',
    'appointmentId',
    'consultationId',
    'fileId',
    'noteId',
    'formId',
  ]
  
  // Check for sensitive params that aren't explicitly allowed
  for (const param of sensitiveParams) {
    if (searchParams.has(param) && !allowedParams.includes(param)) {
      const value = searchParams.get(param)
      if (value && !isValidId(value)) {
        suspiciousParams.push(param)
      }
    }
  }
  
  return {
    detected: suspiciousParams.length > 0,
    suspiciousParams,
  }
}

/**
 * Guard function to validate route access
 */
export async function guardRouteAccess(
  request: NextRequest,
  userRole: string,
  requiredRole: 'doctor' | 'patient' | 'admin',
  resourceType?: string,
  resourceId?: string
): Promise<void> {
  const requestId = request.headers.get('x-request-id') || uuidv4()
  const pathname = request.nextUrl.pathname
  
  // Check role access
  if (userRole !== requiredRole && userRole !== 'admin') {
    await logUnauthorizedAccess(
      undefined, // userId will be extracted from request if available
      resourceType || 'route',
      resourceId || pathname,
      `Required role: ${requiredRole}, user role: ${userRole}`,
      getRequestFromNextRequest(request),
      requestId
    )
    
    throw new Error(`Access denied: ${requiredRole} role required`)
  }
}

/**
 * Guard function to validate ID parameter
 */
export function guardIdParam(
  id: string | string[] | undefined,
  paramName: string = 'id'
): string {
  return validateRouteId(id, paramName)
}

/**
 * Guard function to validate multiple IDs
 */
export function guardIds(ids: Record<string, string | string[] | undefined>): Record<string, string> {
  const validated: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(ids)) {
    validated[key] = validateRouteId(value, key)
  }
  
  return validated
}

/**
 * Extract and validate ID from pathname
 */
export function extractIdFromPath(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern)
  if (match && match[1]) {
    const id = match[1]
    if (isValidId(id)) {
      return id
    }
  }
  return null
}

/**
 * Common ID extraction patterns
 */
export const ID_PATTERNS = {
  patient: /\/patients?\/([^/]+)/,
  doctor: /\/doctors?\/([^/]+)/,
  appointment: /\/appointments?\/([^/]+)/,
  message: /\/messages?\/([^/]+)/,
  form: /\/forms?\/([^/]+)/,
  summary: /\/summaries?\/([^/]+)/,
  visitNote: /\/visit-notes?\/([^/]+)/,
  file: /\/files?\/([^/]+)/,
}

