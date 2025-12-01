/**
 * Cloud Functions Memory Cache for Non-PHI Metadata
 * 
 * Simple in-memory cache for Cloud Functions
 * Used for non-sensitive metadata that doesn't need persistence
 * Cleared on function instance restart
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<any>>()

/**
 * Set value in memory cache
 */
export function memoryCacheSet<T = any>(
  key: string,
  value: T,
  ttl: number = 5 * 60 * 1000 // Default 5 minutes
): void {
  const expiresAt = Date.now() + ttl
  memoryCache.set(key, { value, expiresAt })
}

/**
 * Get value from memory cache
 * Returns null if not found or expired
 */
export function memoryCacheGet<T = any>(key: string): T | null {
  const entry = memoryCache.get(key)
  
  if (!entry) {
    return null
  }
  
  // Check expiration
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key)
    return null
  }
  
  return entry.value as T
}

/**
 * Invalidate entry in memory cache
 */
export function memoryCacheInvalidate(key: string): void {
  memoryCache.delete(key)
}

/**
 * Invalidate all entries matching a pattern
 */
export function memoryCacheInvalidatePattern(pattern: string | RegExp): number {
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  let deletedCount = 0
  
  for (const key of memoryCache.keys()) {
    if (regex.test(key)) {
      memoryCache.delete(key)
      deletedCount++
    }
  }
  
  return deletedCount
}

/**
 * Clear all expired entries
 */
export function memoryCacheClearExpired(): number {
  const now = Date.now()
  let deletedCount = 0
  
  for (const [key, entry] of memoryCache.entries()) {
    if (entry.expiresAt < now) {
      memoryCache.delete(key)
      deletedCount++
    }
  }
  
  return deletedCount
}

/**
 * Clear entire memory cache
 */
export function memoryCacheClear(): void {
  memoryCache.clear()
}

/**
 * Get cache size
 */
export function memoryCacheSize(): number {
  return memoryCache.size
}

