/**
 * Response Cache Utility for Non-PHI Static Responses
 * 
 * Provides in-memory caching with TTL for non-sensitive static data.
 * DO NOT cache PHI or patient-specific data.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
  hitCount: number
}

class ResponseCache {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private maxSize = 1000 // Maximum cache entries
  private defaultTTL = 300000 // 5 minutes default TTL

  /**
   * Get cached value if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    // Update hit count
    entry.hitCount++

    return entry.data as T
  }

  /**
   * Set cache value with optional TTL (in milliseconds)
   */
  set<T>(key: string, value: T, ttl: number = this.defaultTTL): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest()
    }

    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + ttl,
      hitCount: 0,
    })
  }

  /**
   * Delete cache entry
   */
  delete(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Evict oldest entries (LRU-like eviction)
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries())
    
    // Sort by hit count (lowest first) and expiration time
    entries.sort((a, b) => {
      if (a[1].hitCount !== b[1].hitCount) {
        return a[1].hitCount - b[1].hitCount
      }
      return a[1].expiresAt - b[1].expiresAt
    })

    // Remove bottom 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1)
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0])
    }
  }

  /**
   * Clean expired entries (should be called periodically)
   */
  cleanExpired(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const entries = Array.from(this.cache.values())
    return {
      size: this.cache.size,
      totalHits: entries.reduce((sum, e) => sum + e.hitCount, 0),
      averageHits: entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.hitCount, 0) / entries.length 
        : 0,
    }
  }
}

// Singleton instance
export const responseCache = new ResponseCache()

// Clean expired entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    responseCache.cleanExpired()
  }, 5 * 60 * 1000)
}

/**
 * Cache key generators for common cacheable resources
 */
export const cacheKeys = {
  doctorList: (clinicId: string) => `doctors:clinic:${clinicId}`,
  formTemplates: (clinicId: string, type?: string) => 
    `forms:templates:${clinicId}:${type || 'all'}`,
  appointmentTypes: () => 'appointment:types',
  visitTypes: () => 'visit:types',
}

/**
 * Generate cache key from request parameters
 */
export function generateCacheKey(prefix: string, params: Record<string, any>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${JSON.stringify(params[key])}`)
    .join('&')
  
  return `${prefix}:${sortedParams}`
}

