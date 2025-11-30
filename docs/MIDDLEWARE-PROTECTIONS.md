# Middleware Protections - Complete

## Overview

Enhanced middleware protections have been implemented to prevent unauthorized access, query param spoofing, invalid IDs, and unknown routes.

## Protections Implemented

### ✅ 1. Role-Based Route Separation

**Doctor Routes Protection:**
- Patients cannot access `/doctor/*` routes
- Redirects patients to `/patient` portal
- Logs unauthorized access attempts

**Patient Routes Protection:**
- Doctors cannot access `/patient/*` routes
- Redirects doctors to `/dashboard`
- Logs unauthorized access attempts

**Implementation:**
```typescript
// Prevent patients from accessing doctor routes
if (matchesRoute(pathname, DOCTOR_ROUTES)) {
  if (role === 'patient') {
    // Log and redirect
    return redirect('/patient')
  }
}

// Prevent doctors from accessing patient routes
if (matchesRoute(pathname, PATIENT_ROUTES)) {
  if (role === 'doctor') {
    // Log and redirect
    return redirect('/dashboard')
  }
}
```

### ✅ 2. Query Param Spoofing Prevention

**Detected Patterns:**
- Sensitive ID parameters in query strings (`patientId`, `doctorId`, etc.)
- Invalid ID formats in query parameters
- Path traversal attempts (`..`, `//`)
- Encoded traversal attempts (`%2e%2e`, `%2f%2f`)

**Response:**
- Returns 400 Bad Request
- Logs security violation
- Blocks request before authentication

**Example:**
```
❌ /api/patients?patientId=12345  (spoofing attempt)
✅ /api/patients (uses authenticated user's ID)
```

### ✅ 3. Invalid/Missing ID Validation

**ID Format Validation:**
- CUID format: `c[a-z0-9]{24}`
- UUID format: `[0-9a-f]{8}-[0-9a-f]{4}-...`
- Flexible: `[a-zA-Z0-9_-]{1,100}`

**Validation Points:**
- Route parameters: `/patients/[id]`
- Query parameters: `?id=...`
- Path segments: `/patients/12345`

**Response:**
- Returns 400 Bad Request for invalid IDs
- Logs security violation
- Prevents resource enumeration

**Example:**
```
❌ /patients/12345  (invalid ID format)
✅ /patients/c123456789012345678901234  (valid CUID)
```

### ✅ 4. Unknown Route 404 Rewriting

**Route Validation:**
- Checks against known valid route patterns
- Returns 404 for unknown routes
- Prevents information disclosure

**Valid Route Patterns:**
- Public routes: `/`, `/login`, `/signup/*`
- Doctor routes: `/doctor/*`, `/dashboard`
- Patient routes: `/patient/*`
- API routes: `/api/*`

**Response:**
- Returns 404 Not Found
- Logs unknown route access
- Prevents route enumeration

### ✅ 5. Enhanced Route Guards

**Client-Side Guards:**
- `AuthGuard` component enhanced with cross-role prevention
- Automatic redirects based on role
- Pathname-based protection

**Server-Side Guards:**
- `guardRouteAccess()` - Role validation
- `guardIdParam()` - ID format validation
- `checkQueryParamSpoofing()` - Spoofing detection

## Usage Examples

### Server-Side Route Protection

```typescript
import { guardRouteAccess, guardIdParam } from '@/lib/security/route-guards'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Validate ID format
  const id = guardIdParam(params.id, 'id')
  
  // Validate role access
  const user = await requireAuth(request)
  await guardRouteAccess(request, user.role, 'doctor', 'patient', id)
  
  // Continue with request...
}
```

### Client-Side Route Protection

```tsx
import { AuthGuard } from '@/components/auth/AuthGuard'

export default function DoctorPage() {
  return (
    <AuthGuard requiredRole="doctor" preventCrossRoleAccess>
      <DoctorContent />
    </AuthGuard>
  )
}
```

### ID Validation

```typescript
import { validateRouteId, isValidId } from '@/lib/security/route-guards'

// In API route
const patientId = validateRouteId(params.patientId, 'patientId')

// In component
if (!isValidId(id)) {
  return <div>Invalid ID</div>
}
```

## Security Features

### Audit Logging

All security violations are logged:
- Unauthorized access attempts
- Query param spoofing
- Invalid ID formats
- Unknown route access

### Automatic Redirects

- Patients accessing doctor routes → `/patient`
- Doctors accessing patient routes → `/dashboard`
- Unauthenticated users → `/login`

### Request Blocking

- Invalid IDs → 400 Bad Request
- Query param spoofing → 400 Bad Request
- Unknown routes → 404 Not Found
- Unauthorized access → 403 Forbidden or redirect

## Route Patterns

### Doctor Routes
- `/doctor/*`
- `/dashboard/doctor/*`
- `/api/doctor/*`
- `/api/billing/doctor/*`
- `/api/appointments/doctor/*`

### Patient Routes
- `/patient/*`
- `/dashboard/patient/*`
- `/api/patient/*`
- `/api/payments/patient/*`
- `/api/appointments/patient/*`
- `/api/visit-notes/patient/*`

## Files Updated

### Core Files
- ✅ `middleware.ts` - Enhanced with all protections
- ✅ `lib/security/route-guards.ts` - New route guard utilities
- ✅ `components/auth/AuthGuard.tsx` - Enhanced client-side guard

### Integration
- All route protections work together
- Middleware blocks before route handlers
- Client-side guards provide additional protection
- Audit logging tracks all violations

## Testing

### Test Role Separation

```bash
# As patient, try to access doctor route
curl -H "Cookie: ..." http://localhost:3000/doctor/appointments
# Should redirect to /patient

# As doctor, try to access patient route
curl -H "Cookie: ..." http://localhost:3000/patient/visits
# Should redirect to /dashboard
```

### Test ID Validation

```bash
# Invalid ID format
curl http://localhost:3000/patients/12345
# Should return 400

# Valid ID format
curl http://localhost:3000/patients/c123456789012345678901234
# Should work (if authenticated)
```

### Test Query Param Spoofing

```bash
# Spoofing attempt
curl "http://localhost:3000/api/patients?patientId=12345"
# Should return 400
```

## Best Practices

1. **Always validate IDs** - Use `guardIdParam()` or `validateRouteId()`
2. **Check role access** - Use `guardRouteAccess()` in API routes
3. **Use AuthGuard** - Wrap protected pages with `AuthGuard`
4. **Enable cross-role prevention** - Set `preventCrossRoleAccess={true}`
5. **Monitor audit logs** - Review security violations regularly

## Status

✅ **COMPLETE** - All middleware protections implemented and active!

