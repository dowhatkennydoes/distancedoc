/**
 * Validation Utility
 * 
 * Centralized validation function for API routes.
 * Provides consistent error handling and type safety.
 */

import { z, ZodSchema, ZodError } from 'zod'
import { apiError } from '@/lib/auth/api-protection'

/**
 * Validate payload against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param payload - Data to validate
 * @param requestId - Optional request ID for error logging
 * @returns Validated and typed data
 * @throws ZodError if validation fails
 */
export function validate<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  requestId?: string
): T {
  try {
    return schema.parse(payload)
  } catch (error) {
    if (error instanceof ZodError) {
      // Format validation errors for API response
      const errors = error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))

      const errorMessage = `Validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`
      
      // Throw a formatted error that can be caught by API error handler
      const validationError: Error & { statusCode?: number; errors?: typeof errors } = new Error(errorMessage)
      validationError.statusCode = 400
      validationError.errors = errors
      
      throw validationError
    }
    
    // Re-throw non-Zod errors
    throw error
  }
}

/**
 * Validate payload and return formatted error response if validation fails
 * 
 * This is a convenience wrapper that catches validation errors and returns
 * an API error response directly.
 * 
 * @param schema - Zod schema to validate against
 * @param payload - Data to validate
 * @param requestId - Request ID for error logging
 * @returns Object with success flag and either validated data or error response
 */
export function validateOrError<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  requestId?: string
): { success: true; data: T } | { success: false; error: Response } {
  try {
    const data = validate(schema, payload, requestId)
    return { success: true, data }
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error && error.statusCode === 400) {
      const zodError = error as Error & { errors?: Array<{ path: string; message: string; code: string }> }
      return {
        success: false,
        error: apiError(
          error.message,
          400,
          requestId,
          zodError.errors ? { validationErrors: zodError.errors } : undefined
        ),
      }
    }
    
    // Unexpected error
    return {
      success: false,
      error: apiError('Validation error', 400, requestId),
    }
  }
}

/**
 * Helper to format Zod errors for logging
 */
export function formatValidationErrors(error: ZodError): string {
  return error.errors
    .map((err) => {
      const path = err.path.length > 0 ? err.path.join('.') : 'root'
      return `${path}: ${err.message}`
    })
    .join(', ')
}

