// Rate limiting middleware for API routes
// TODO: Implement rate limiting using in-memory store or Redis
// TODO: Support different limits per route
// TODO: Return proper rate limit headers
// TODO: Handle rate limit exceeded responses

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string // Custom key generator
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

// In-memory store (use Redis in production)
const requestStore = new Map<string, { count: number; resetTime: number }>()

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of requestStore.entries()) {
    if (value.resetTime < now) {
      requestStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from auth token
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    // In production, decode JWT to get user ID
    // For now, use IP + user agent as fallback
  }
  
  // Fallback to IP address + user agent
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  return `${ip}:${userAgent}`
}

export function createRateLimiter(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    const key = config.keyGenerator 
      ? config.keyGenerator(request)
      : getClientIdentifier(request)
    
    const now = Date.now()
    const entry = requestStore.get(key)
    
    // Check if entry exists and is still valid
    if (entry && entry.resetTime > now) {
      // Increment count
      entry.count++
      
      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
        return new NextResponse(
          JSON.stringify({ 
            error: 'Too many requests',
            retryAfter 
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
            },
          }
        )
      }
      
      // Update entry
      requestStore.set(key, entry)
    } else {
      // Create new entry
      requestStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      })
    }
    
    return null // No rate limit exceeded
  }
}

// Pre-configured rate limiters
export const rateLimiters = {
  // Strict rate limit for auth endpoints (prevent brute force)
  auth: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 requests per 15 minutes
  }),
  
  // Standard rate limit for API endpoints
  api: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  }),
  
  // Lenient rate limit for file uploads
  upload: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 uploads per minute
  }),
  
  // Very strict for sensitive operations
  sensitive: createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 requests per hour
  }),
}

