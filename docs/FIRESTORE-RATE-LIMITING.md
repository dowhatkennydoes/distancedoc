# Firestore-Backed Rate Limiting

## Overview

Rate limiting has been migrated from in-memory storage to Firestore-backed counters for distributed rate limiting across multiple server instances.

## Features

✅ **Distributed Rate Limiting** - Works across multiple server instances
✅ **Atomic Counters** - Uses Firestore transactions for thread-safe increments
✅ **Automatic Cleanup** - Expired entries are automatically removed
✅ **Per-User & Per-IP** - Supports both user-based and IP-based rate limiting
✅ **Configurable Windows** - Flexible time windows and limits

## Rate Limits Implemented

### Login Attempts
- **Limit**: 5 attempts per minute
- **Key**: Email address or IP
- **Endpoint**: `/api/auth/login`

### AI SOAP Generation
- **Limit**: 10 generations per minute per doctor
- **Key**: User ID
- **Endpoint**: `/api/ai/soap`

### STT Chunks
- **Limit**: 10 chunks per second
- **Key**: User ID
- **Endpoint**: `/api/stt/stream`

### Messaging
- **Limit**: 20 messages per minute per user
- **Key**: User ID
- **Endpoint**: `/api/chat` (POST)

### File Uploads
- **Limit**: 10 uploads per minute
- **Key**: User ID
- **Endpoint**: `/api/files/upload-url`

### General API
- **Limit**: 60 requests per minute
- **Key**: User ID or IP
- **Endpoint**: General API routes

### Sensitive Operations
- **Limit**: 10 requests per hour
- **Key**: User ID
- **Endpoint**: High-risk operations

## Usage

### Basic Rate Limiting

```typescript
import { rateLimit } from '@/lib/security/firestore-rate-limit'

const result = await rateLimit(
  'user:user-123', // Key
  10,              // Max requests
  60000,           // Window: 1 minute
  'user-123',      // User ID (optional, for logging)
  '/api/endpoint'  // Endpoint (optional, for logging)
)

if (!result.allowed) {
  return new Response('Too many requests', { 
    status: 429,
    headers: {
      'Retry-After': result.retryAfter?.toString()
    }
  })
}
```

### Using Pre-configured Limiters

```typescript
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'

// Login rate limiting
const loginLimit = await firestoreRateLimiters.login(request, email)
if (loginLimit) {
  return loginLimit // 429 response
}

// SOAP generation rate limiting
const user = await requireAuth(request)
const soapLimit = await firestoreRateLimiters.soapGeneration(request, user.id)
if (soapLimit) {
  return soapLimit // 429 response
}

// STT chunks rate limiting
const sttLimit = await firestoreRateLimiters.sttChunks(request, user.id)
if (sttLimit) {
  return sttLimit // 429 response
}

// Messaging rate limiting
const messageLimit = await firestoreRateLimiters.messaging(request, user.id)
if (messageLimit) {
  return messageLimit // 429 response
}
```

### Custom Rate Limiting

```typescript
import { checkRateLimit } from '@/lib/security/firestore-rate-limit'

const limitResponse = await checkRateLimit(request, {
  maxRequests: 20,
  windowMs: 60000, // 1 minute
  keyPrefix: 'custom',
  userId: user.id,
})

if (limitResponse) {
  return limitResponse // 429 response
}
```

## Implementation Details

### Firestore Structure

Rate limit counters are stored in the `rate_limits` collection:

```
rate_limits/
  {key}/
    count: number
    windowStart: timestamp
    expiresAt: timestamp
    createdAt: timestamp
    updatedAt: timestamp
```

### Key Generation

Keys are generated as:
```
rate_limit:{prefix}:{identifier}:{windowStart}
```

Examples:
- `rate_limit:login:user:user-123:1704067200000`
- `rate_limit:soap:user:doctor-456:1704067200000`
- `rate_limit:stt:ip:192.168.1.1:1704067200000`

### Atomic Operations

Rate limiting uses Firestore transactions to ensure atomic counter increments:

```typescript
await firestore.runTransaction(async (transaction) => {
  const doc = await transaction.get(rateLimitRef)
  const currentCount = doc.data()?.count || 0
  const newCount = currentCount + 1
  
  if (newCount > maxRequests) {
    return { count: newCount, allowed: false }
  }
  
  transaction.update(rateLimitRef, { count: newCount })
  return { count: newCount, allowed: true }
})
```

### Cleanup

Expired rate limit entries are automatically cleaned up every 5 minutes. Entries older than 1 hour are removed.

## Migration from In-Memory

The old in-memory rate limiter (`lib/security/rate-limit.ts`) is still available for backward compatibility, but all high-risk endpoints have been migrated to Firestore-backed rate limiting.

### Benefits of Firestore-Backed Rate Limiting

1. **Distributed** - Works across multiple server instances
2. **Persistent** - Survives server restarts
3. **Scalable** - Handles high concurrency
4. **Accurate** - Atomic operations prevent race conditions
5. **Auditable** - Rate limit violations are logged

## API Updates

### Updated Endpoints

✅ `/api/auth/login` - 5 attempts per minute
✅ `/api/ai/soap` - 10 per minute per doctor
✅ `/api/stt/stream` - 10 chunks per second
✅ `/api/stt/stream/sse` - 10 chunks per second
✅ `/api/chat` (POST) - 20 messages per minute
✅ `/api/files/upload-url` - 10 uploads per minute

## Response Headers

Rate limit responses include standard headers:

```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-01-01T00:01:00Z
Retry-After: 60
```

## Error Handling

Rate limiting uses a "fail open" strategy:
- If Firestore is unavailable, requests are allowed
- Errors are logged but don't block requests
- This prevents rate limiting from becoming a single point of failure

## Performance

- **Latency**: ~10-50ms per rate limit check (Firestore read + transaction)
- **Throughput**: Handles thousands of requests per second
- **Cost**: Minimal Firestore reads/writes (1 read + 1 write per check)

## Monitoring

Rate limit violations are automatically logged via the PHI-safe event logging system:

```typescript
await logRateLimitViolation(
  userId,
  endpoint,
  maxRequests,
  request,
  requestId
)
```

## Best Practices

1. **Check rate limits early** - Before expensive operations
2. **Use user IDs when available** - More accurate than IP-based
3. **Set appropriate limits** - Balance security with usability
4. **Monitor violations** - Track patterns and adjust limits
5. **Fail open** - Don't block requests if rate limiting fails

## Configuration

Rate limits can be adjusted in `lib/security/firestore-rate-limit.ts`:

```typescript
export const firestoreRateLimiters = {
  login: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  soapGeneration: {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
  },
  // ...
}
```

## Testing

To test rate limiting:

```bash
# Test login rate limit (5/min)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"test"}'
  sleep 1
done
# 6th request should return 429
```

## Troubleshooting

### Rate limits not working
- Check Firestore connection
- Verify service account permissions
- Check Firestore security rules

### Too many Firestore reads
- Adjust cleanup interval
- Reduce rate limit check frequency
- Use caching for frequently accessed limits

### Performance issues
- Consider using Redis for very high-traffic endpoints
- Batch rate limit checks where possible
- Monitor Firestore quota usage

