/**
 * Unified Cache Interface
 * 
 * Provides a single interface for all caching strategies:
 * - Firestore cache (chat)
 * - Redis cache (static assets)
 * - LRU cache (clinic settings, form templates)
 * - Memory cache (Cloud Functions metadata)
 */

import { firestoreCacheGet, firestoreCacheSet, firestoreCacheInvalidate } from './firestore-cache'
import { redisCacheGet, redisCacheSet, redisCacheInvalidate } from './redis-cache'
import { lruCacheGet, lruCacheSet, lruCacheInvalidate, CacheType } from './lru-cache'
import { memoryCacheGet, memoryCacheSet, memoryCacheInvalidate } from './memory-cache'

export type CacheStrategy = 'firestore' | 'redis' | 'lru' | 'memory'

export interface CacheOptions {
  strategy?: CacheStrategy
  ttl?: number // Time to live in seconds (or milliseconds for LRU/memory)
  namespace?: string // For Redis namespacing
  cacheType?: CacheType // For LRU cache type selection
}

/**
 * Universal cache get function
 * Automatically selects the appropriate cache strategy
 */
export async function cacheGet<T = any>(
  key: string,
  options?: CacheOptions
): Promise<T | null> {
  const strategy = options?.strategy || determineStrategy(key)
  
  switch (strategy) {
    case 'firestore':
      return firestoreCacheGet<T>(getCollectionFromKey(key), getDocIdFromKey(key))
    
    case 'redis':
      return redisCacheGet<T>(key, { namespace: options?.namespace })
    
    case 'lru':
      if (!options?.cacheType) {
        throw new Error('cacheType is required for LRU cache')
      }
      return lruCacheGet<T>(options.cacheType, key) || null
    
    case 'memory':
      return memoryCacheGet<T>(key)
    
    default:
      console.warn(`Unknown cache strategy: ${strategy}, falling back to memory cache`)
      return memoryCacheGet<T>(key)
  }
}

/**
 * Universal cache set function
 * Automatically selects the appropriate cache strategy
 */
export async function cacheSet<T = any>(
  key: string,
  value: T,
  options?: CacheOptions
): Promise<void> {
  const strategy = options?.strategy || determineStrategy(key)
  
  switch (strategy) {
    case 'firestore':
      await firestoreCacheSet(
        getCollectionFromKey(key),
        getDocIdFromKey(key),
        value,
        { ttl: options?.ttl }
      )
      break
    
    case 'redis':
      await redisCacheSet(key, value, {
        ttl: options?.ttl,
        namespace: options?.namespace,
      })
      break
    
    case 'lru':
      if (!options?.cacheType) {
        throw new Error('cacheType is required for LRU cache')
      }
      lruCacheSet(options.cacheType, key, value, {
        ttl: options?.ttl ? options.ttl * 1000 : undefined, // Convert to milliseconds
      })
      break
    
    case 'memory':
      memoryCacheSet(key, value, options?.ttl ? options.ttl * 1000 : undefined)
      break
    
    default:
      console.warn(`Unknown cache strategy: ${strategy}, falling back to memory cache`)
      memoryCacheSet(key, value, options?.ttl ? options.ttl * 1000 : undefined)
  }
}

/**
 * Universal cache invalidate function
 * Automatically selects the appropriate cache strategy
 */
export async function cacheInvalidate(
  key: string,
  options?: CacheOptions
): Promise<void> {
  const strategy = options?.strategy || determineStrategy(key)
  
  switch (strategy) {
    case 'firestore':
      await firestoreCacheInvalidate(getCollectionFromKey(key), getDocIdFromKey(key))
      break
    
    case 'redis':
      await redisCacheInvalidate(key, { namespace: options?.namespace })
      break
    
    case 'lru':
      if (!options?.cacheType) {
        throw new Error('cacheType is required for LRU cache')
      }
      lruCacheInvalidate(options.cacheType, key)
      break
    
    case 'memory':
      memoryCacheInvalidate(key)
      break
    
    default:
      console.warn(`Unknown cache strategy: ${strategy}, falling back to memory cache`)
      memoryCacheInvalidate(key)
  }
}

/**
 * Determine cache strategy based on key pattern
 */
function determineStrategy(key: string): CacheStrategy {
  // Chat messages use Firestore
  if (key.startsWith('chat:') || key.startsWith('message:')) {
    return 'firestore'
  }
  
  // Static assets use Redis
  if (key.startsWith('asset:') || key.startsWith('file:') || key.startsWith('image:')) {
    return 'redis'
  }
  
  // Clinic settings, form templates, doctor profiles, AI hints use LRU
  if (
    key.startsWith('clinic:') ||
    key.startsWith('form:') ||
    key.startsWith('doctor:') ||
    key.startsWith('ai:')
  ) {
    return 'lru'
  }
  
  // Everything else uses memory cache (Cloud Functions metadata)
  return 'memory'
}

/**
 * Extract collection name from Firestore key
 * Format: "collection:docId" or "chat:messageId"
 */
function getCollectionFromKey(key: string): string {
  const parts = key.split(':')
  if (parts.length >= 2) {
    // Handle nested keys like "chat:messages:messageId"
    return parts.slice(0, -1).join(':')
  }
  return 'cache' // Default collection
}

/**
 * Extract document ID from Firestore key
 */
function getDocIdFromKey(key: string): string {
  const parts = key.split(':')
  return parts[parts.length - 1]
}

// Re-export cache types for convenience
export { CacheType } from './lru-cache'
export * from './firestore-cache'
export * from './redis-cache'
export * from './lru-cache'
export * from './memory-cache'

