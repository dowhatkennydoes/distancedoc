// Secure error handling
// TODO: Sanitize error messages
// TODO: Prevent information disclosure
// TODO: Log errors securely
// TODO: Return user-friendly error messages

import { NextResponse } from 'next/server'
import { logError } from './logging'
import { z } from 'zod'

// Error types that should not expose internal details
const SENSITIVE_ERROR_PATTERNS = [
  /database/i,
  /sql/i,
  /connection/i,
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /credential/i,
]

// Check if error message contains sensitive information
function isSensitiveError(message: string): boolean {
  return SENSITIVE_ERROR_PATTERNS.some(pattern => pattern.test(message))
}

// Sanitize error message for client
function sanitizeErrorMessage(error: Error | string, defaultMessage: string = 'An error occurred'): string {
  const message = typeof error === 'string' ? error : error.message
  
  // Don't expose sensitive errors
  if (isSensitiveError(message)) {
    return defaultMessage
  }
  
  // Don't expose stack traces or internal details
  if (message.includes('at ') || message.includes('Error:')) {
    return defaultMessage
  }
  
  // Return sanitized message (limited length)
  return message.substring(0, 200)
}

// Handle API errors securely
export function handleApiError(
  error: unknown,
  defaultMessage: string = 'Internal server error',
  userId?: string,
  requestId?: string
): NextResponse {
  // Log the full error (with PHI redaction)
  if (error instanceof Error) {
    logError('API error occurred', error, undefined, userId, requestId)
  } else {
    logError('API error occurred', new Error(String(error)), undefined, userId, requestId)
  }
  
  // Determine status code
  let status = 500
  let message = defaultMessage
  
  if (error instanceof z.ZodError) {
    status = 400
    message = `Validation error: ${error.errors.map(e => e.message).join(', ')}`
  } else if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      status = 401
      message = 'Unauthorized'
    } else if (error.message === 'Forbidden') {
      status = 403
      message = 'Forbidden'
    } else if (error.message === 'Not Found') {
      status = 404
      message = 'Not Found'
    } else {
      // Sanitize error message
      message = sanitizeErrorMessage(error, defaultMessage)
    }
  }
  
  // Return sanitized error response
  return NextResponse.json(
    { error: message },
    { status }
  )
}

