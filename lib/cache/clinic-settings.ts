/**
 * Cache Utilities for Clinic Settings
 * 
 * Caches clinic settings using LRU cache for fast repeated access
 */

import { cacheGet, cacheSet, cacheInvalidate, CacheType } from './index'

const CACHE_PREFIX = 'clinic:settings:'

/**
 * Get cached clinic settings
 */
export async function getCachedClinicSettings(clinicId: string): Promise<any | null> {
  const key = `${CACHE_PREFIX}${clinicId}`
  return cacheGet(key, {
    strategy: 'lru',
    cacheType: CacheType.CLINIC_SETTINGS,
  })
}

/**
 * Cache clinic settings
 */
export async function setCachedClinicSettings(
  clinicId: string,
  settings: any,
  ttl: number = 1800 // 30 minutes default
): Promise<void> {
  const key = `${CACHE_PREFIX}${clinicId}`
  await cacheSet(key, settings, {
    strategy: 'lru',
    cacheType: CacheType.CLINIC_SETTINGS,
    ttl,
  })
}

/**
 * Invalidate cached clinic settings
 */
export async function invalidateClinicSettings(clinicId: string): Promise<void> {
  const key = `${CACHE_PREFIX}${clinicId}`
  await cacheInvalidate(key, {
    strategy: 'lru',
    cacheType: CacheType.CLINIC_SETTINGS,
  })
}

