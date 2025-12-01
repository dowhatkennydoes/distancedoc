/**
 * Cache Utilities for Doctor Profile Information
 * 
 * Caches doctor profile data using LRU cache
 */

import { cacheGet, cacheSet, cacheInvalidate, CacheType } from './index'

const CACHE_PREFIX = 'doctor:profile:'

/**
 * Get cached doctor profile
 */
export async function getCachedDoctorProfile(doctorId: string): Promise<any | null> {
  const key = `${CACHE_PREFIX}${doctorId}`
  return cacheGet(key, {
    strategy: 'lru',
    cacheType: CacheType.DOCTOR_PROFILES,
  })
}

/**
 * Cache doctor profile
 */
export async function setCachedDoctorProfile(
  doctorId: string,
  profile: any,
  ttl: number = 900 // 15 minutes default
): Promise<void> {
  const key = `${CACHE_PREFIX}${doctorId}`
  await cacheSet(key, profile, {
    strategy: 'lru',
    cacheType: CacheType.DOCTOR_PROFILES,
    ttl,
  })
}

/**
 * Invalidate cached doctor profile
 */
export async function invalidateDoctorProfile(doctorId: string): Promise<void> {
  const key = `${CACHE_PREFIX}${doctorId}`
  await cacheInvalidate(key, {
    strategy: 'lru',
    cacheType: CacheType.DOCTOR_PROFILES,
  })
}

/**
 * Invalidate all doctor profiles for a clinic
 */
export function invalidateClinicDoctorProfiles(clinicId: string): void {
  const { lruCacheInvalidatePattern } = require('./lru-cache')
  const pattern = new RegExp(`^${CACHE_PREFIX}clinic:${clinicId}:`)
  lruCacheInvalidatePattern(CacheType.DOCTOR_PROFILES, pattern)
}

