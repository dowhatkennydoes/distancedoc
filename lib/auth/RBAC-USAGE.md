# RBAC System Usage Guide

## Overview

The Role-Based Access Control (RBAC) system provides granular permission checking for DistanceDoc. It defines permissions for each role and allows checking access at both the middleware and API route levels.

## Permissions Structure

### Permission Format
Permissions follow the pattern: `resource:action`

Examples:
- `appointments:view` - View appointments
- `appointments:create` - Create appointments
- `appointments:manage` - Full CRUD access to appointments

### Available Permissions

See `lib/auth/permissions.ts` for the complete list of permissions. Key categories:

- **Appointments**: `APPOINTMENTS_VIEW`, `APPOINTMENTS_CREATE`, `APPOINTMENTS_UPDATE`, `APPOINTMENTS_DELETE`, `APPOINTMENTS_MANAGE`
- **Visit Notes**: `NOTES_VIEW`, `NOTES_CREATE`, `NOTES_UPDATE`, `NOTES_APPROVE`, `NOTES_MANAGE`
- **Prescriptions**: `PRESCRIPTIONS_VIEW`, `PRESCRIPTIONS_CREATE`, `PRESCRIPTIONS_UPDATE`, `PRESCRIPTIONS_DELETE`, `PRESCRIPTIONS_MANAGE`
- **Lab Orders**: `LABS_VIEW`, `LABS_CREATE`, `LABS_UPDATE`, `LABS_DELETE`, `LABS_MANAGE`
- **Messages**: `MESSAGES_VIEW`, `MESSAGES_SEND`, `MESSAGES_DELETE`, `MESSAGES_MANAGE`
- **Patients**: `PATIENTS_VIEW`, `PATIENTS_CREATE`, `PATIENTS_UPDATE`, `PATIENTS_DELETE`, `PATIENTS_MANAGE`
- **Files**: `FILES_VIEW`, `FILES_UPLOAD`, `FILES_DELETE`, `FILES_MANAGE`
- **Billing**: `BILLING_VIEW`, `BILLING_CREATE`, `BILLING_UPDATE`, `BILLING_REFUND`, `BILLING_MANAGE`
- **Admin**: `ADMIN_AUDIT_LOGS`, `ADMIN_APPROVE_DOCTORS`, `ADMIN_MANAGE_USERS`, `ADMIN_SYSTEM_SETTINGS`, `ADMIN_FULL_ACCESS`
- **Support**: `SUPPORT_VIEW_APPOINTMENTS`, `SUPPORT_VIEW_MESSAGES`, `SUPPORT_VIEW_PATIENTS`, `SUPPORT_VIEW_BILLING`, `SUPPORT_VIEW_LOGS`

## Role Permissions

### Doctor
- Full management of appointments, notes, prescriptions, labs, messages
- View and update patient records (for their patients)
- View and upload files
- Manage intake forms
- View and manage billing
- Full consultation management
- Video call access

### Patient
- View own appointments (can create/update own)
- View own visit notes
- View own prescriptions
- View own lab results
- View and send messages
- View and update own profile
- View own files, can upload
- Submit intake forms
- View own billing
- View own consultations, can join video calls

### Admin
- All doctor permissions
- Access audit logs
- Approve doctors
- Manage all users
- System settings access
- Full access to all resources

### Support
- Read-only access to appointments, messages, patients, billing
- View audit logs

## Usage Examples

### 1. Basic Permission Check

```typescript
import { canAccess, PERMISSIONS } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/api-protection'

export async function GET(request: NextRequest) {
  const user = await requireAuth(request)
  
  if (!canAccess(user.role, PERMISSIONS.APPOINTMENTS_VIEW)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // ... handler
}
```

### 2. Using withAuth Wrapper with Permissions

```typescript
import { withAuth } from '@/lib/auth/api-protection'
import { PERMISSIONS } from '@/lib/auth/permissions'

export const GET = withAuth(
  async (request, user) => {
    // User is authenticated and has permission
    // ... handler
  },
  {
    permissions: PERMISSIONS.APPOINTMENTS_VIEW,
  }
)
```

### 3. Multiple Permissions (Any)

```typescript
export const POST = withAuth(
  async (request, user) => {
    // User has at least one of the permissions
    // ... handler
  },
  {
    permissions: [
      PERMISSIONS.APPOINTMENTS_CREATE,
      PERMISSIONS.APPOINTMENTS_UPDATE,
    ],
    requireAllPermissions: false, // Default: any permission
  }
)
```

### 4. Multiple Permissions (All)

```typescript
export const DELETE = withAuth(
  async (request, user) => {
    // User has all of the permissions
    // ... handler
  },
  {
    permissions: [
      PERMISSIONS.APPOINTMENTS_DELETE,
      PERMISSIONS.APPOINTMENTS_MANAGE,
    ],
    requireAllPermissions: true, // Requires all permissions
  }
)
```

### 5. Combined Role and Permission Check

```typescript
export const GET = withAuth(
  async (request, user) => {
    // User is doctor AND has permission
    // ... handler
  },
  {
    roles: ['doctor'],
    requireApproval: true,
    permissions: PERMISSIONS.NOTES_MANAGE,
  }
)
```

### 6. Server Component Permission Check

```typescript
import { canAccess, PERMISSIONS } from '@/lib/auth/permissions'
import { requireAuth } from '@/lib/auth/utils'

export default async function Page() {
  const user = await requireAuth()
  
  if (!canAccess(user.role, PERMISSIONS.PATIENTS_VIEW)) {
    redirect('/dashboard')
  }
  
  // ... component
}
```

### 7. Check Multiple Permissions

```typescript
import { canAccessAny, canAccessAll, PERMISSIONS } from '@/lib/auth/permissions'

// Check if user has any of the permissions
const canView = canAccessAny(user.role, [
  PERMISSIONS.APPOINTMENTS_VIEW,
  PERMISSIONS.APPOINTMENTS_MANAGE,
])

// Check if user has all of the permissions
const canManage = canAccessAll(user.role, [
  PERMISSIONS.APPOINTMENTS_VIEW,
  PERMISSIONS.APPOINTMENTS_CREATE,
  PERMISSIONS.APPOINTMENTS_UPDATE,
])
```

### 8. Get All Permissions for Role

```typescript
import { getRolePermissions } from '@/lib/auth/permissions'

const doctorPermissions = getRolePermissions('doctor')
// Returns array of all permissions for doctor role
```

### 9. Check if Permission Requires Ownership

```typescript
import { requiresOwnership, PERMISSIONS } from '@/lib/auth/permissions'

if (requiresOwnership(PERMISSIONS.APPOINTMENTS_UPDATE)) {
  // This permission requires resource ownership
  // Additional check needed to verify user owns the resource
}
```

## Middleware Integration

The middleware automatically checks permissions for routes defined in `ROUTE_PERMISSIONS`. Routes are matched by:

1. Method-specific route (e.g., `POST:/api/appointments`)
2. Pathname only (e.g., `/api/appointments`)
3. Prefix matching

### Adding Route Permissions

Edit `ROUTE_PERMISSIONS` in `lib/auth/permissions.ts`:

```typescript
export const ROUTE_PERMISSIONS: Record<string, Permission | Permission[]> = {
  '/api/appointments': PERMISSIONS.APPOINTMENTS_VIEW,
  'POST:/api/appointments': PERMISSIONS.APPOINTMENTS_CREATE,
  // ... more routes
}
```

## Best Practices

1. **Use Granular Permissions**: Prefer specific permissions over broad ones
2. **Check Ownership**: For patient permissions, always verify resource ownership
3. **Log Permission Denials**: All permission denials are automatically logged
4. **Use withAuth Wrapper**: Prefer `withAuth` wrapper for consistent error handling
5. **Combine with Role Checks**: Use both role and permission checks for defense in depth

## Permission Inheritance

- `*:manage` permissions include all actions for that resource
- `ADMIN_FULL_ACCESS` includes all permissions
- Admin role includes all doctor permissions

## Testing Permissions

```typescript
import { canAccess, PERMISSIONS } from '@/lib/auth/permissions'

// Test doctor permissions
expect(canAccess('doctor', PERMISSIONS.APPOINTMENTS_MANAGE)).toBe(true)
expect(canAccess('doctor', PERMISSIONS.ADMIN_FULL_ACCESS)).toBe(false)

// Test patient permissions
expect(canAccess('patient', PERMISSIONS.APPOINTMENTS_VIEW)).toBe(true)
expect(canAccess('patient', PERMISSIONS.APPOINTMENTS_DELETE)).toBe(false)

// Test admin permissions
expect(canAccess('admin', PERMISSIONS.ADMIN_FULL_ACCESS)).toBe(true)
expect(canAccess('admin', PERMISSIONS.APPOINTMENTS_MANAGE)).toBe(true)
```

## Audit Logging

All permission checks are automatically logged:
- `PERMISSION_DENIED` - When access is denied due to insufficient permissions
- Includes: user ID, role, required permissions, pathname, method

## Future Enhancements

- Resource-level permissions (e.g., specific patient access)
- Time-based permissions
- Conditional permissions based on context
- Permission groups/roles
- Custom permission definitions per tenant

