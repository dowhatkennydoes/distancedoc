// Security middleware wrapper for API routes
// TODO: Apply rate limiting, security headers, and error handling
// TODO: Add request ID generation
// TODO: Add audit logging

import { NextRequest, NextResponse } from 'next/server'
import { rateLimiters } from './rate-limit'
import { addSecurityHeaders, configureCORS } from './headers'
import { handleApiError } from './error-handler'
import { logInfo, logError } from './logging'
import { v4 as uuidv4 } from 'uuid'

interface MiddlewareOptions {
  rateLimiter?: 'auth' | 'api' | 'upload' | 'sensitive'
  requireAuth?: boolean
  cors?: boolean
}

export function withSecurity<T>(
  handler: (request: NextRequest, requestId: string) => Promise<NextResponse<T>>,
  options: MiddlewareOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = uuidv4()
    const startTime = Date.now()
    
    try {
      // Rate limiting
      if (options.rateLimiter) {
        const rateLimiter = rateLimiters[options.rateLimiter]
        const rateLimitResponse = await rateLimiter(request)
        if (rateLimitResponse) {
          return addSecurityHeaders(rateLimitResponse)
        }
      }
      
      // CORS
      let response: NextResponse
      if (options.cors) {
        const origin = request.headers.get('origin')
        response = await handler(request, requestId)
        response = configureCORS(response, origin || undefined)
      } else {
        response = await handler(request, requestId)
      }
      
      // Add security headers
      response = addSecurityHeaders(response)
      
      // Log request
      const duration = Date.now() - startTime
      logInfo('API request completed', {
        method: request.method,
        path: request.nextUrl.pathname,
        status: response.status,
        duration,
      }, undefined, requestId)
      
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      logError('API request failed', error as Error, {
        method: request.method,
        path: request.nextUrl.pathname,
        duration,
      }, undefined, requestId)
      
      return addSecurityHeaders(handleApiError(error, 'Internal server error', undefined, requestId))
    }
  }
}

