/**
 * Cache Utilities for AI Model Hints
 * 
 * Caches AI model hints using LRU cache
 * AI hints change rarely, so longer TTL is appropriate
 */

import { cacheGet, cacheSet, cacheInvalidate, CacheType } from './index'

const CACHE_PREFIX = 'ai:hints:'

/**
 * Get cached AI model hints
 */
export async function getCachedAIHints(modelId: string): Promise<any | null> {
  const key = `${CACHE_PREFIX}${modelId}`
  return cacheGet(key, {
    strategy: 'lru',
    cacheType: CacheType.AI_HINTS,
  })
}

/**
 * Cache AI model hints
 */
export async function setCachedAIHints(
  modelId: string,
  hints: any,
  ttl: number = 86400 // 24 hours default (AI hints change rarely)
): Promise<void> {
  const key = `${CACHE_PREFIX}${modelId}`
  await cacheSet(key, hints, {
    strategy: 'lru',
    cacheType: CacheType.AI_HINTS,
    ttl,
  })
}

/**
 * Invalidate cached AI hints
 */
export async function invalidateAIHints(modelId: string): Promise<void> {
  const key = `${CACHE_PREFIX}${modelId}`
  await cacheInvalidate(key, {
    strategy: 'lru',
    cacheType: CacheType.AI_HINTS,
  })
}

/**
 * Invalidate all AI hints
 */
export function invalidateAllAIHints(): void {
  const { lruCacheInvalidatePattern } = require('./lru-cache')
  const pattern = new RegExp(`^${CACHE_PREFIX}`)
  lruCacheInvalidatePattern(CacheType.AI_HINTS, pattern)
}

