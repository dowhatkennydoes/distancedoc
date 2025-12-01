/**
 * Cache Utilities for Intake Form Templates
 * 
 * Caches form templates using LRU cache for fast access
 */

import { cacheGet, cacheSet, cacheInvalidate, CacheType } from './index'

const CACHE_PREFIX = 'form:template:'

/**
 * Get cached intake form template
 */
export async function getCachedIntakeTemplate(formId: string): Promise<any | null> {
  const key = `${CACHE_PREFIX}${formId}`
  return cacheGet(key, {
    strategy: 'lru',
    cacheType: CacheType.FORM_TEMPLATES,
  })
}

/**
 * Cache intake form template
 */
export async function setCachedIntakeTemplate(
  formId: string,
  template: any,
  ttl: number = 3600 // 1 hour default
): Promise<void> {
  const key = `${CACHE_PREFIX}${formId}`
  await cacheSet(key, template, {
    strategy: 'lru',
    cacheType: CacheType.FORM_TEMPLATES,
    ttl,
  })
}

/**
 * Invalidate cached intake form template
 */
export async function invalidateIntakeTemplate(formId: string): Promise<void> {
  const key = `${CACHE_PREFIX}${formId}`
  await cacheInvalidate(key, {
    strategy: 'lru',
    cacheType: CacheType.FORM_TEMPLATES,
  })
}

/**
 * Invalidate all templates for a clinic
 */
export function invalidateClinicTemplates(clinicId: string): void {
  const { lruCacheInvalidatePattern } = require('./lru-cache')
  const pattern = new RegExp(`^${CACHE_PREFIX}clinic:${clinicId}:`)
  lruCacheInvalidatePattern(CacheType.FORM_TEMPLATES, pattern)
}

/**
 * Invalidate pattern-based (helper function)
 */
export function invalidateIntakeTemplatePattern(pattern: string | RegExp): number {
  const { lruCacheInvalidatePattern } = require('./lru-cache')
  const regex = typeof pattern === 'string' ? new RegExp(`^${CACHE_PREFIX}${pattern}`) : pattern
  return lruCacheInvalidatePattern(CacheType.FORM_TEMPLATES, regex)
}

