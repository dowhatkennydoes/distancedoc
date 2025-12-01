/**
 * Redis Cache for Static Assets
 * 
 * Uses Redis for caching static assets (images, files, etc.)
 * Provides fast access to frequently requested resources
 * 
 * Installation: npm install redis
 */

import Redis from 'redis'

let redisClient: ReturnType<typeof Redis.createClient> | null = null

export interface RedisCacheOptions {
  ttl?: number // Time to live in seconds
  namespace?: string // Optional namespace prefix for keys
}

/**
 * Initialize Redis client (singleton pattern)
 */
function getRedisClient() {
  if (redisClient) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379'
  
  redisClient = Redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          console.error('Redis connection failed after 10 retries')
          return new Error('Redis connection failed')
        }
        return Math.min(retries * 100, 3000)
      },
    },
  })

  redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err)
  })

  redisClient.on('connect', () => {
    console.log('Redis Client Connected')
  })

  // Connect if not already connected
  if (!redisClient.isOpen) {
    redisClient.connect().catch((err) => {
      console.error('Failed to connect to Redis:', err)
    })
  }

  return redisClient
}

/**
 * Build cache key with optional namespace
 */
function buildKey(key: string, namespace?: string): string {
  return namespace ? `${namespace}:${key}` : key
}

/**
 * Cache static asset in Redis
 */
export async function redisCacheSet(
  key: string,
  value: string | Buffer | object,
  options?: RedisCacheOptions
): Promise<void> {
  try {
    const client = getRedisClient()
    const cacheKey = buildKey(key, options?.namespace)
    
    // Serialize value if object
    const serialized = typeof value === 'object' && !Buffer.isBuffer(value)
      ? JSON.stringify(value)
      : value
    
    if (options?.ttl) {
      await client.setEx(cacheKey, options.ttl, serialized as string | Buffer)
    } else {
      await client.set(cacheKey, serialized as string | Buffer)
    }
  } catch (error) {
    console.error('Redis cache set error:', error)
    // Fail silently - caching is not critical
  }
}

/**
 * Get cached static asset from Redis
 */
export async function redisCacheGet<T = any>(
  key: string,
  options?: RedisCacheOptions
): Promise<T | null> {
  try {
    const client = getRedisClient()
    const cacheKey = buildKey(key, options?.namespace)
    const value = await client.get(cacheKey)
    
    if (!value) {
      return null
    }
    
    // Try to parse as JSON, fallback to string
    try {
      return JSON.parse(value as string) as T
    } catch {
      return value as T
    }
  } catch (error) {
    console.error('Redis cache get error:', error)
    return null
  }
}

/**
 * Invalidate cached static asset
 */
export async function redisCacheInvalidate(
  key: string,
  options?: RedisCacheOptions
): Promise<void> {
  try {
    const client = getRedisClient()
    const cacheKey = buildKey(key, options?.namespace)
    await client.del(cacheKey)
  } catch (error) {
    console.error('Redis cache invalidate error:', error)
    // Fail silently
  }
}

/**
 * Invalidate all keys matching a pattern
 */
export async function redisCacheInvalidatePattern(
  pattern: string,
  options?: RedisCacheOptions
): Promise<number> {
  try {
    const client = getRedisClient()
    const fullPattern = buildKey(pattern, options?.namespace)
    const keys = await client.keys(fullPattern)
    
    if (keys.length === 0) {
      return 0
    }
    
    await client.del(keys)
    return keys.length
  } catch (error) {
    console.error('Redis cache invalidate pattern error:', error)
    return 0
  }
}

/**
 * Get multiple cached values
 */
export async function redisCacheGetMany<T = any>(
  keys: string[],
  options?: RedisCacheOptions
): Promise<Map<string, T>> {
  const result = new Map<string, T>()
  
  try {
    const client = getRedisClient()
    const cacheKeys = keys.map(key => buildKey(key, options?.namespace))
    const values = await client.mGet(cacheKeys)
    
    cacheKeys.forEach((cacheKey, index) => {
      const value = values[index]
      if (value) {
        try {
          result.set(keys[index], JSON.parse(value) as T)
        } catch {
          result.set(keys[index], value as T)
        }
      }
    })
  } catch (error) {
    console.error('Redis cache get many error:', error)
  }
  
  return result
}

/**
 * Close Redis connection (for cleanup)
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit()
    redisClient = null
  }
}

