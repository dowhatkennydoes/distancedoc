# Server Admin Helper Documentation

## Overview

The `getServerAdmin()` helper provides safe, non-throwing admin authentication for Next.js Server Components. It uses the Supabase SSR client safely and handles all edge cases gracefully.

## Features

- ✅ **Never throws on null sessions** - All errors are handled gracefully
- ✅ **Uses Supabase SSR client safely** - Proper cookie handling and session management
- ✅ **Type-safe return values** - Clear `allowed` and `reason` structure
- ✅ **Automatic redirect support** - `requireServerAdmin()` helper for convenience
- ✅ **Graceful error handling** - Returns structured errors instead of throwing

## API Reference

### `getServerAdmin()`

Returns a result object indicating whether the user is authenticated and is an admin.

**Returns:**
```typescript
{
  allowed: true,
  user: AuthUser
} | {
  allowed: false,
  reason: 'unauthenticated' | 'not_admin'
}
```

**Example:**
```tsx
const result = await getServerAdmin()

if (!result.allowed) {
  if (result.reason === 'unauthenticated') {
    redirect('/login')
  } else {
    redirect('/dashboard')
  }
}

const user = result.user // Guaranteed to exist when allowed is true
```

### `requireServerAdmin()`

Convenience wrapper that automatically redirects to `/login` if not allowed. Returns the admin user directly.

**Returns:**
```typescript
Promise<AuthUser> // Always returns a user (redirects if not admin)
```

**Example:**
```tsx
const user = await requireServerAdmin()
// User is guaranteed to be admin at this point
```

## Usage Examples

### Example 1: Simple Admin Page (Recommended)

```tsx
import { requireServerAdmin } from '@/lib/auth/utils'

export default async function AdminDashboardPage() {
  const user = await requireServerAdmin()
  
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user.email}</p>
    </div>
  )
}
```

### Example 2: Custom Redirect Logic

```tsx
import { getServerAdmin } from '@/lib/auth/utils'
import { redirect } from 'next/navigation'

export default async function AdminSettingsPage() {
  const adminCheck = await getServerAdmin()
  
  if (!adminCheck.allowed) {
    if (adminCheck.reason === 'unauthenticated') {
      redirect('/login?redirect=/admin/settings')
    } else {
      redirect('/dashboard?error=admin_required')
    }
  }
  
  const user = adminCheck.user!
  
  return (
    <div>
      <h1>Settings</h1>
      <p>Configure system for {user.email}</p>
    </div>
  )
}
```

### Example 3: Custom Error UI

```tsx
import { getServerAdmin } from '@/lib/auth/utils'

export default async function AdminReportsPage() {
  const adminCheck = await getServerAdmin()
  
  if (!adminCheck.allowed) {
    return (
      <div className="container mx-auto p-6">
        <h1>Access Denied</h1>
        <p>
          {adminCheck.reason === 'unauthenticated'
            ? 'Please log in to access this page'
            : 'You do not have admin permissions'}
        </p>
      </div>
    )
  }
  
  return <div>Reports for {adminCheck.user!.email}</div>
}
```

### Example 4: Server Action

```tsx
'use server'

import { requireServerAdmin } from '@/lib/auth/utils'

export async function deleteUser(userId: string) {
  const admin = await requireServerAdmin()
  
  // Admin is guaranteed here - proceed with deletion
  // ... deletion logic
  
  return { success: true }
}
```

## Implementation Details

### Null-Safe Session Handling

The helper never throws errors, even when:
- Supabase client creation fails
- Session validation fails
- Database queries fail
- User is null or undefined
- Role data is missing

All failures result in `{ allowed: false, reason: 'unauthenticated' }`.

### Supabase SSR Client

Uses `createClient()` from `@/lib/supabase/server` which:
- Properly handles cookies via `next/headers`
- Works in Server Components
- Refreshes sessions automatically
- Handles middleware session updates

### Role Validation

The helper:
1. Validates the session exists and is valid
2. Fetches user role from `user_roles` table
3. Checks if role is `'admin'`
4. Returns appropriate error if not admin

## Migration Guide

### Before (Client Component)

```tsx
"use client"

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/login')
    }
  }, [user, loading, router])
  
  if (loading) return <Loading />
  if (!user || user.role !== 'admin') return null
  
  return <div>Admin Content</div>
}
```

### After (Server Component)

```tsx
import { requireServerAdmin } from '@/lib/auth/utils'

export default async function AdminPage() {
  const user = await requireServerAdmin()
  
  return <div>Admin Content for {user.email}</div>
}
```

## Benefits

1. **Simpler Code** - No loading states or useEffect hooks needed
2. **Better Performance** - Server-side rendering, no client-side checks
3. **Type Safety** - TypeScript knows user is admin when function returns
4. **Security** - Server-side validation, can't be bypassed client-side
5. **SEO Friendly** - Server-rendered content

## Error Handling

The helper handles all error cases gracefully:

| Error Case | Result |
|------------|--------|
| Supabase client creation fails | `{ allowed: false, reason: 'unauthenticated' }` |
| Session validation fails | `{ allowed: false, reason: 'unauthenticated' }` |
| User not found | `{ allowed: false, reason: 'unauthenticated' }` |
| Role not found | `{ allowed: false, reason: 'unauthenticated' }` |
| User is not admin | `{ allowed: false, reason: 'not_admin' }` |
| Database query fails | `{ allowed: false, reason: 'unauthenticated' }` |

## Best Practices

1. **Use `requireServerAdmin()` for simple cases** - Automatic redirect is convenient
2. **Use `getServerAdmin()` for custom logic** - When you need specific error handling
3. **Always check `allowed` before accessing `user`** - TypeScript helps but be explicit
4. **Use redirect in Server Components** - `redirect()` from `next/navigation` works perfectly
5. **Log admin access** - Consider adding audit logging for admin operations

## Security Notes

- ✅ All validation happens server-side
- ✅ Session is validated via Supabase
- ✅ Role is checked against database
- ✅ No client-side checks (these are for UX only)
- ✅ Proper cookie handling prevents session hijacking

## Related Files

- `/lib/auth/utils.ts` - Implementation
- `/lib/auth/server-admin-example.tsx` - Complete examples
- `/lib/supabase/server.ts` - Supabase SSR client
- `/middleware.ts` - Route-level protection

