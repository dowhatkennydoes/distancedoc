/**
 * In-Memory LRU Cache for Clinic Settings and Form Templates
 * 
 * Fast in-memory cache for frequently accessed data:
 * - Clinic settings
 * - Form templates
 * - Repeated calculations
 * 
 * Uses LRU (Least Recently Used) eviction policy
 */

import { LRUCache } from 'lru-cache'

export interface LRUCacheOptions {
  maxSize?: number // Maximum number of items in cache
  ttl?: number // Time to live in milliseconds
}

// Create separate caches for different data types
const clinicSettingsCache = new LRUCache<string, any>({
  max: 100, // Cache up to 100 clinic settings
  ttl: 1000 * 60 * 30, // 30 minutes
})

const formTemplatesCache = new LRUCache<string, any>({
  max: 500, // Cache up to 500 form templates
  ttl: 1000 * 60 * 60, // 1 hour
})

const calculationCache = new LRUCache<string, any>({
  max: 1000, // Cache up to 1000 calculations
  ttl: 1000 * 60 * 10, // 10 minutes
})

const doctorProfileCache = new LRUCache<string, any>({
  max: 200, // Cache up to 200 doctor profiles
  ttl: 1000 * 60 * 15, // 15 minutes
})

const aiHintsCache = new LRUCache<string, any>({
  max: 100, // Cache up to 100 AI model hints
  ttl: 1000 * 60 * 60 * 24, // 24 hours (AI hints change rarely)
})

// Cache type enum
export enum CacheType {
  CLINIC_SETTINGS = 'clinic_settings',
  FORM_TEMPLATES = 'form_templates',
  CALCULATIONS = 'calculations',
  DOCTOR_PROFILES = 'doctor_profiles',
  AI_HINTS = 'ai_hints',
}

/**
 * Get the appropriate cache instance based on type
 */
function getCache(type: CacheType): LRUCache<string, any> {
  switch (type) {
    case CacheType.CLINIC_SETTINGS:
      return clinicSettingsCache
    case CacheType.FORM_TEMPLATES:
      return formTemplatesCache
    case CacheType.CALCULATIONS:
      return calculationCache
    case CacheType.DOCTOR_PROFILES:
      return doctorProfileCache
    case CacheType.AI_HINTS:
      return aiHintsCache
    default:
      return clinicSettingsCache
  }
}

/**
 * Set value in LRU cache
 */
export function lruCacheSet<T = any>(
  type: CacheType,
  key: string,
  value: T,
  options?: LRUCacheOptions
): void {
  const cache = getCache(type)
  
  // Apply custom TTL if provided
  if (options?.ttl) {
    cache.set(key, value, { ttl: options.ttl })
  } else {
    cache.set(key, value)
  }
}

/**
 * Get value from LRU cache
 */
export function lruCacheGet<T = any>(
  type: CacheType,
  key: string
): T | undefined {
  const cache = getCache(type)
  return cache.get(key) as T | undefined
}

/**
 * Invalidate entry in LRU cache
 */
export function lruCacheInvalidate(
  type: CacheType,
  key: string
): void {
  const cache = getCache(type)
  cache.delete(key)
}

/**
 * Invalidate all entries matching a pattern
 */
export function lruCacheInvalidatePattern(
  type: CacheType,
  pattern: string | RegExp
): number {
  const cache = getCache(type)
  let deletedCount = 0
  
  const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
  
  for (const key of cache.keys()) {
    if (regex.test(key)) {
      cache.delete(key)
      deletedCount++
    }
  }
  
  return deletedCount
}

/**
 * Clear entire cache of a specific type
 */
export function lruCacheClear(type: CacheType): void {
  const cache = getCache(type)
  cache.clear()
}

/**
 * Get cache statistics
 */
export function lruCacheStats(type: CacheType): {
  size: number
  maxSize: number
  hitRate: number
} {
  const cache = getCache(type)
  
  return {
    size: cache.size,
    maxSize: cache.max ?? 0,
    hitRate: (cache as any).calculatedSize ? 
      (cache as any).calculatedSize / (cache.max ?? 1) : 0,
  }
}

/**
 * Get all cache statistics
 */
export function getAllLRUCacheStats(): Record<CacheType, {
  size: number
  maxSize: number
}> {
  return {
    [CacheType.CLINIC_SETTINGS]: lruCacheStats(CacheType.CLINIC_SETTINGS),
    [CacheType.FORM_TEMPLATES]: lruCacheStats(CacheType.FORM_TEMPLATES),
    [CacheType.CALCULATIONS]: lruCacheStats(CacheType.CALCULATIONS),
    [CacheType.DOCTOR_PROFILES]: lruCacheStats(CacheType.DOCTOR_PROFILES),
    [CacheType.AI_HINTS]: lruCacheStats(CacheType.AI_HINTS),
  }
}

