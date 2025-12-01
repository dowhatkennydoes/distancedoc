# Middleware Upgrade - Strict Route Protection

## Overview

The middleware has been upgraded to enforce strict routing rules with centralized route-role mapping and comprehensive access control.

## Key Features

### 1. Centralized Route-Role Mapping

All routes are now mapped to their required roles in a single `routeRoleMap`:

```typescript
const routeRoleMap: Map<string | RegExp, RouteRoleConfig> = new Map([
  // Doctor routes
  ['/doctor/appointments', { requiredRoles: ['doctor'], requiresApproval: true }],
  [/^\/doctor\/patients\/([^/]+)$/, { 
    requiredRoles: ['doctor'], 
    requiresApproval: true, 
    idParam: 'patientId' 
  }],
  
  // Patient routes
  ['/patient', { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/patient\/forms\/([^/]+)$/, { 
    requiredRoles: ['patient'], 
    requiresOwnership: true 
  }],
])
```

### 2. Centralized Guard for Role Matching

The `checkRoleAccess()` function provides a single point for access control:

```typescript
async function checkRoleAccess(
  pathname: string,
  userRole: UserRole,
  roleData: { approved: boolean; clinicId: string; ... },
  userId: string,
  supabase: any
): Promise<{ allowed: boolean; reason?: string; redirectTo?: string }>
```

**Checks:**
- ✅ Required roles match
- ✅ Approval status (for doctors)
- ✅ Ownership validation (prevents ID spoofing)
- ✅ Clinic access

### 3. Strict Route Protection

#### Doctor Routes (`/doctor/*`)
- ✅ Only doctors can access
- ✅ Must be approved (except `/doctor/pending`)
- ✅ Prevents patients from accessing

#### Patient Routes (`/patient/*`)
- ✅ Only patients can access
- ✅ Requires ownership validation
- ✅ Prevents doctors from accessing

### 4. ID Spoofing Prevention

**Example:** `/patient/forms/[id]` or `/patient/summaries/[id]`

The middleware validates:
- ✅ Patient can only access their own resources
- ✅ Extracted ID must match logged-in patient's ID
- ✅ Query parameters are also validated

```typescript
async function validateOwnership(
  pathname: string,
  userId: string,
  userRole: UserRole,
  roleData: { doctorId?: string; patientId?: string; ... },
  supabase: any
): Promise<{ valid: boolean; reason?: string }>
```

**Prevents:**
- ❌ `/patient/forms/other-patient-id` → Blocked
- ❌ `/patient/summaries/another-id` → Blocked
- ✅ `/patient/forms/own-id` → Allowed

### 5. Required Parameter Validation

Missing required parameters are detected and rejected:

```typescript
function validateRequiredParams(
  pathname: string, 
  searchParams: URLSearchParams
): { valid: boolean; missingParams: string[] }
```

**Example:**
- `/doctor/patients/` without ID → Rejected
- `/patient/forms/` without ID → Rejected

### 6. Automatic Redirects

Unauthorized users are automatically redirected:

- **Unauthenticated** → `/login?redirect=<original-path>&error=session_expired`
- **Wrong role** → Role-specific dashboard (`/patient` or `/dashboard`)
- **Not approved** → `/doctor/pending`
- **Ownership violation** → Role-specific dashboard

### 7. Clean JSON Errors for API Routes

API routes receive clean JSON error responses:

```json
{
  "error": "Forbidden: Access denied",
  "requestId": "req-123",
  "statusCode": 403
}
```

Page routes receive redirects to appropriate pages.

## Route Configuration

### RouteRoleConfig Interface

```typescript
interface RouteRoleConfig {
  requiredRoles: UserRole[]        // ['doctor'] | ['patient'] | ['admin']
  requiresApproval?: boolean        // For doctor routes
  requiresOwnership?: boolean       // For patient routes with IDs
  idParam?: string                 // 'patientId' | 'doctorId' | etc.
}
```

### Example Configurations

#### Doctor Route (Approval Required)
```typescript
['/doctor/appointments', { 
  requiredRoles: ['doctor'], 
  requiresApproval: true 
}]
```

#### Patient Route (Ownership Required)
```typescript
['/patient', { 
  requiredRoles: ['patient'], 
  requiresOwnership: true 
}]
```

#### Dynamic Route with ID Parameter
```typescript
[/^\/doctor\/patients\/([^/]+)$/, { 
  requiredRoles: ['doctor'], 
  requiresApproval: true, 
  idParam: 'patientId' 
}]
```

## Security Features

### 1. Query Parameter Spoofing Detection

Detects and blocks:
- Path traversal attempts (`..`, `//`)
- Encoded traversal attempts (`%2e%2e`)
- Invalid ID formats in query parameters

### 2. ID Format Validation

Validates IDs are:
- CUID format: `c[a-z0-9]{24}`
- UUID format: `[0-9a-f]{8}-...`
- Flexible alphanumeric: `[a-zA-Z0-9_-]{1,100}`

### 3. Rate Limiting

- 10 authentication attempts per 15 minutes
- Per-IP tracking
- Automatic reset after window expires

### 4. Comprehensive Audit Logging

All access attempts are logged:
- ✅ Successful access
- ❌ Failed authentication
- ❌ Access denied (wrong role)
- ❌ Ownership violations
- ❌ Security violations

## Usage Examples

### Doctor Accessing Patient Data

```typescript
// Route: /doctor/patients/[patientId]
// User: doctor (approved)
// Result: ✅ Allowed (doctor can view patient details)
```

### Patient Accessing Own Data

```typescript
// Route: /patient/forms/[formId]
// User: patient
// ID in path: matches patient's ID
// Result: ✅ Allowed
```

### Patient Attempting Spoofing

```typescript
// Route: /patient/forms/other-patient-id
// User: patient
// ID in path: does NOT match patient's ID
// Result: ❌ Blocked with 403 Forbidden
```

### Unauthorized Role Access

```typescript
// Route: /doctor/appointments
// User: patient
// Result: ❌ Redirected to /patient
```

### Unapproved Doctor

```typescript
// Route: /doctor/appointments
// User: doctor (not approved)
// Result: ❌ Redirected to /doctor/pending
```

## Response Types

### API Routes (JSON)

```json
{
  "error": "Forbidden: Access denied",
  "requestId": "req-abc-123",
  "statusCode": 403
}
```

### Page Routes (Redirect)

- Unauthenticated → `/login?redirect=/path&error=session_expired`
- Wrong role → `/patient` or `/dashboard`
- Not approved → `/doctor/pending`

## Headers Added

All responses include security headers:
- `X-Request-ID` - Request trace ID
- `X-User-Role` - User's role
- `X-User-ID` - User's ID
- `X-Clinic-ID` - Clinic ID (tenant isolation)

## Benefits

✅ **Centralized Configuration** - All route rules in one place  
✅ **Strict Enforcement** - No bypassing of role checks  
✅ **ID Spoofing Prevention** - Users can't access others' resources  
✅ **Clean Errors** - Proper JSON for APIs, redirects for pages  
✅ **Comprehensive Logging** - Full audit trail  
✅ **Maintainable** - Easy to add new routes  
✅ **Type Safe** - TypeScript interfaces ensure correctness  

## Adding New Routes

To add a new route, simply add it to `routeRoleMap`:

```typescript
// Example: New doctor route
['/doctor/labs', { 
  requiredRoles: ['doctor'], 
  requiresApproval: true 
}],

// Example: New patient route with ownership
[/^\/patient\/reports\/([^/]+)$/, { 
  requiredRoles: ['patient'], 
  requiresOwnership: true 
}],
```

The middleware will automatically enforce the rules!

