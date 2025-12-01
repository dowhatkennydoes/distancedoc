# Caching System Installation Guide

## Quick Start

### Step 1: Install Dependencies

```bash
npm install redis lru-cache
```

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# Redis (optional - defaults to localhost:6379)
REDIS_URL=redis://localhost:6379

# Or for Redis Cloud/Production
REDISCLOUD_URL=redis://user:password@host:port
```

### Step 3: Verify Installation

The caching system will automatically:
- ✅ Use Firestore for chat messages (no additional setup)
- ✅ Use Redis for static assets (if REDIS_URL is set)
- ✅ Use LRU cache for clinic settings, templates, profiles (in-memory)
- ✅ Use memory cache for Cloud Functions metadata (in-memory)

---

## Testing Cache Functionality

### Test LRU Cache (No Setup Required)

```typescript
import { cacheGet, cacheSet, cacheInvalidate, CacheType } from '@/lib/cache'

// Set cache
await cacheSet('form:template:123', { title: 'Test Form' }, {
  strategy: 'lru',
  cacheType: CacheType.FORM_TEMPLATES,
  ttl: 3600
})

// Get cache
const form = await cacheGet('form:template:123', {
  strategy: 'lru',
  cacheType: CacheType.FORM_TEMPLATES,
})

console.log(form) // { title: 'Test Form' }
```

### Test Redis Cache (Requires Redis)

```bash
# Start Redis locally (if not using cloud)
redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:alpine
```

```typescript
import { redisCacheSet, redisCacheGet } from '@/lib/cache/redis-cache'

// Set cache
await redisCacheSet('asset:image123', imageData, { ttl: 3600 })

// Get cache
const image = await redisCacheGet('asset:image123')
```

---

## Production Setup

### Redis Setup

#### Option 1: Redis Cloud (Recommended)

1. Sign up at https://redis.com/cloud
2. Create a database
3. Get connection URL
4. Set `REDISCLOUD_URL` environment variable

#### Option 2: Self-Hosted Redis

1. Install Redis on server
2. Configure authentication
3. Set `REDIS_URL` environment variable

#### Option 3: GCP Memorystore (GCP Users)

1. Create Memorystore Redis instance
2. Configure VPC peering
3. Use internal IP for `REDIS_URL`

---

## Monitoring

### Cache Statistics

```typescript
import { getAllLRUCacheStats } from '@/lib/cache/lru-cache'

const stats = getAllLRUCacheStats()
console.log(stats)
// {
//   CLINIC_SETTINGS: { size: 45, maxSize: 100 },
//   FORM_TEMPLATES: { size: 120, maxSize: 500 },
//   ...
// }
```

### Cache Hit Rate Monitoring

Monitor cache effectiveness:
- Track cache hits vs misses in your application logs
- Use performance monitoring tools
- Check cache statistics regularly

---

## Troubleshooting

### Redis Connection Issues

**Error:** `Redis connection failed`

**Solutions:**
1. Check Redis is running: `redis-cli ping`
2. Verify `REDIS_URL` is correct
3. Check firewall/network settings
4. Verify authentication credentials

### Cache Not Working

**Check:**
1. Dependencies installed: `npm list redis lru-cache`
2. Cache functions called correctly
3. TTL values are reasonable
4. Cache keys are consistent

### Memory Issues (LRU Cache)

**Symptoms:** High memory usage

**Solutions:**
1. Reduce max cache sizes in `lru-cache.ts`
2. Reduce TTL values
3. Monitor cache statistics
4. Implement cache eviction policies

---

## Performance Tuning

### Recommended TTL Values

| Data Type | TTL | Reason |
|-----------|-----|--------|
| Form Templates | 1 hour | Change rarely |
| Clinic Settings | 30 minutes | Change occasionally |
| Doctor Profiles | 15 minutes | Change frequently |
| AI Hints | 24 hours | Change very rarely |
| Static Assets | 1-24 hours | Based on update frequency |

### Cache Size Recommendations

| Cache Type | Max Size | Reason |
|------------|----------|--------|
| Clinic Settings | 100 | Limited number of clinics |
| Form Templates | 500 | Moderate number of templates |
| Doctor Profiles | 200 | Moderate number of doctors |
| AI Hints | 100 | Limited number of models |
| Calculations | 1000 | High frequency calculations |

---

## Security Considerations

### ✅ Safe to Cache:
- Form templates (no PHI)
- Clinic settings (configuration only)
- Doctor profiles (non-sensitive info)
- AI hints (model configuration)
- Static assets (public files)

### ❌ Never Cache:
- Patient medical records (PHI)
- Authentication tokens
- Payment information
- Encryption keys
- Passwords or credentials

---

## Next Steps

1. **Monitor Performance:** Track cache hit rates
2. **Tune TTL Values:** Adjust based on usage patterns
3. **Scale Redis:** If using Redis, plan for scaling
4. **Add Monitoring:** Set up alerts for cache failures
5. **Document Patterns:** Document caching patterns for your team

---

## Support

For issues or questions:
1. Check cache statistics
2. Review error logs
3. Verify configuration
4. Test with minimal setup first

