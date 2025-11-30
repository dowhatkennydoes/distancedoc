/**
 * Firestore-Backed Rate Limiting
 * 
 * Uses Firestore counters for distributed rate limiting across multiple server instances.
 * Implements atomic counter increments using Firestore transactions.
 * 
 * Features:
 * - Distributed rate limiting (works across multiple servers)
 * - Atomic counter operations
 * - Automatic cleanup of expired entries
 * - Per-user and per-IP rate limiting
 * - Configurable windows and limits
 */

import { NextRequest, NextResponse } from 'next/server'
import { getFirestore } from '@/lib/gcp/gcp-firestore'
import { Firestore } from '@google-cloud/firestore'
import { logRateLimitViolation, getRequestFromNextRequest } from './event-logging'

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetTime: number
  retryAfter?: number
}

/**
 * Rate limit configuration
 */
export interface RateLimitOptions {
  maxRequests: number
  windowMs: number
  key: string
  userId?: string
  endpoint?: string
}

/**
 * Get client identifier from request (IP-based)
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  const ip = forwarded?.split(',')[0].trim() || realIP || cfConnectingIP || 'unknown'
  return `ip:${ip}`
}

/**
 * Get user identifier from request (if authenticated)
 */
async function getUserIdFromRequest(request: NextRequest): Promise<string | undefined> {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader) return undefined
    
    // Try to decode JWT or get user from session
    // For now, we'll extract it from the token if possible
    // In production, you'd decode the JWT to get the user ID
    return undefined
  } catch {
    return undefined
  }
}

/**
 * Generate rate limit key
 */
function generateKey(prefix: string, identifier: string, windowStart: number): string {
  return `rate_limit:${prefix}:${identifier}:${windowStart}`
}

/**
 * Get current window start timestamp
 */
function getWindowStart(windowMs: number): number {
  const now = Date.now()
  return Math.floor(now / windowMs) * windowMs
}

/**
 * Clean up expired rate limit entries (runs periodically)
 */
let cleanupInterval: NodeJS.Timeout | null = null

function startCleanupInterval() {
  if (cleanupInterval) return
  
  // Clean up expired entries every 5 minutes
  cleanupInterval = setInterval(async () => {
    try {
      const firestore = getFirestore()
      const rateLimitRef = firestore.collection('rate_limits')
      const now = Date.now()
      
      // Delete entries older than 1 hour
      const oneHourAgo = now - (60 * 60 * 1000)
      const expiredQuery = rateLimitRef
        .where('expiresAt', '<', new Date(oneHourAgo))
        .limit(100)
      
      const snapshot = await expiredQuery.get()
      const batch = firestore.batch()
      
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref)
      })
      
      if (snapshot.docs.length > 0) {
        await batch.commit()
      }
    } catch (error) {
      console.error('Rate limit cleanup error:', error)
    }
  }, 5 * 60 * 1000) // Every 5 minutes
}

// Start cleanup on module load
if (typeof process !== 'undefined') {
  startCleanupInterval()
}

/**
 * Rate limit check using Firestore atomic counters
 * 
 * @param key - Unique identifier for the rate limit (e.g., userId, IP, endpoint)
 * @param maxRequests - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 * @param userId - Optional user ID for logging
 * @param endpoint - Optional endpoint for logging
 * @returns Rate limit result
 */
export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  userId?: string,
  endpoint?: string
): Promise<RateLimitResult> {
  const firestore = getFirestore()
  const windowStart = getWindowStart(windowMs)
  const rateLimitKey = generateKey('default', key, windowStart)
  const expiresAt = new Date(windowStart + windowMs + (60 * 60 * 1000)) // Expire 1 hour after window ends
  
  const rateLimitRef = firestore.collection('rate_limits').doc(rateLimitKey)
  
  try {
    // Use transaction for atomic increment
    const result = await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef)
      
      if (!doc.exists) {
        // Create new counter
        transaction.set(rateLimitRef, {
          count: 1,
          windowStart,
          expiresAt,
          createdAt: Firestore.FieldValue.serverTimestamp(),
        })
        return { count: 1, allowed: true }
      }
      
      const data = doc.data()!
      const currentCount = (data.count as number) || 0
      const newCount = currentCount + 1
      
      // Check if limit exceeded
      if (newCount > maxRequests) {
        return { count: newCount, allowed: false }
      }
      
      // Increment counter
      transaction.update(rateLimitRef, {
        count: newCount,
        updatedAt: Firestore.FieldValue.serverTimestamp(),
      })
      
      return { count: newCount, allowed: true }
    })
    
    const resetTime = windowStart + windowMs
    const remaining = Math.max(0, maxRequests - result.count)
    
    // Log violation if limit exceeded
    if (!result.allowed && endpoint) {
      logRateLimitViolation(
        userId,
        endpoint,
        maxRequests,
        undefined, // Request not available in this context
        undefined
      ).catch(err => console.error('Failed to log rate limit violation:', err))
    }
    
    return {
      allowed: result.allowed,
      remaining,
      resetTime,
      retryAfter: result.allowed ? undefined : Math.ceil((resetTime - Date.now()) / 1000),
    }
  } catch (error) {
    // On error, allow the request (fail open)
    console.error('Rate limit error:', error)
    return {
      allowed: true,
      remaining: maxRequests,
      resetTime: windowStart + windowMs,
    }
  }
}

/**
 * Rate limit middleware for Next.js API routes
 */
export async function checkRateLimit(
  request: NextRequest,
  options: {
    maxRequests: number
    windowMs: number
    keyPrefix?: string
    userId?: string
  }
): Promise<NextResponse | null> {
  const endpoint = new URL(request.url).pathname
  const userId = options.userId || await getUserIdFromRequest(request)
  
  // Generate key based on user or IP
  const identifier = userId ? `user:${userId}` : getClientIdentifier(request)
  const key = options.keyPrefix 
    ? `${options.keyPrefix}:${identifier}`
    : identifier
  
  const result = await rateLimit(
    key,
    options.maxRequests,
    options.windowMs,
    userId,
    endpoint
  )
  
  if (!result.allowed) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter: result.retryAfter,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': result.retryAfter?.toString() || '60',
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
        },
      }
    )
  }
  
  // Add rate limit headers to response
  // Note: We can't modify the response here, so headers will be added by the caller
  return null
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const firestoreRateLimiters = {
  /**
   * Login attempts: 5 per minute
   */
  async login(request: NextRequest, email?: string): Promise<NextResponse | null> {
    const key = email ? `login:${email}` : getClientIdentifier(request)
    return checkRateLimit(request, {
      maxRequests: 5,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'login',
      userId: email, // Use email as identifier
    })
  },
  
  /**
   * AI SOAP generation: 10 per minute per doctor
   */
  async soapGeneration(request: NextRequest, userId: string): Promise<NextResponse | null> {
    return checkRateLimit(request, {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'soap',
      userId,
    })
  },
  
  /**
   * STT chunks: 10 per second
   */
  async sttChunks(request: NextRequest, userId?: string): Promise<NextResponse | null> {
    return checkRateLimit(request, {
      maxRequests: 10,
      windowMs: 1000, // 1 second
      keyPrefix: 'stt',
      userId,
    })
  },
  
  /**
   * Messaging: 20 per minute per user
   */
  async messaging(request: NextRequest, userId: string): Promise<NextResponse | null> {
    return checkRateLimit(request, {
      maxRequests: 20,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'message',
      userId,
    })
  },
  
  /**
   * General API: 60 per minute
   */
  async api(request: NextRequest, userId?: string): Promise<NextResponse | null> {
    return checkRateLimit(request, {
      maxRequests: 60,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'api',
      userId,
    })
  },
  
  /**
   * File uploads: 10 per minute
   */
  async upload(request: NextRequest, userId?: string): Promise<NextResponse | null> {
    return checkRateLimit(request, {
      maxRequests: 10,
      windowMs: 60 * 1000, // 1 minute
      keyPrefix: 'upload',
      userId,
    })
  },
  
  /**
   * Sensitive operations: 10 per hour
   */
  async sensitive(request: NextRequest, userId?: string): Promise<NextResponse | null> {
    return checkRateLimit(request, {
      maxRequests: 10,
      windowMs: 60 * 60 * 1000, // 1 hour
      keyPrefix: 'sensitive',
      userId,
    })
  },
}

