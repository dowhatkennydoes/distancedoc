# AdminRoute Component Documentation

## Overview

The `<AdminRoute>` component provides client-side route protection for admin pages in Next.js. It ensures only authenticated admin users can access wrapped content, automatically redirecting unauthorized users.

## Features

- ✅ **Automatic Redirects** - Unauthenticated users → `/login`, Non-admin users → their dashboard
- ✅ **Full-Screen Loader** - Shows during auth hydration
- ✅ **Dev Console Warnings** - Helpful debugging in development
- ✅ **Hydration-Safe** - Waits for auth state before rendering
- ✅ **Type-Safe** - Full TypeScript support

## Requirements

1. ✅ If `authenticated` is false → redirect to `/login`
2. ✅ If authenticated but role is not admin → redirect to correct dashboard
3. ✅ Full-screen loader while auth is hydrating
4. ✅ Console warnings for dev environment only

## Usage

### Basic Example

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"

export default function AdminDashboardPage() {
  return (
    <AdminRoute>
      <div>
        <h1>Admin Dashboard</h1>
        <p>Only admins can see this</p>
      </div>
    </AdminRoute>
  )
}
```

### With Admin Layout

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"
import { AdminLayout } from "@/components/admin/layout"

export default function AdminSettingsPage() {
  return (
    <AdminRoute>
      <AdminLayout>
        <div className="p-6">
          <h1>Settings</h1>
          <p>Manage system settings</p>
        </div>
      </AdminLayout>
    </AdminRoute>
  )
}
```

### Custom Redirect Destination

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"

export default function AdminReportsPage() {
  return (
    <AdminRoute redirectTo="/login?admin=true">
      <div>
        <h1>Reports</h1>
        <p>Admin reports</p>
      </div>
    </AdminRoute>
  )
}
```

## Behavior

### Unauthenticated Users

When a user is not authenticated:
- Shows full-screen loader
- Logs warning in dev console
- Redirects to `/login` (or custom `redirectTo`)

### Non-Admin Users

When a user is authenticated but not an admin:
- Shows full-screen loader
- Logs warning in dev console with role information
- Redirects to appropriate dashboard:
  - Doctors → `/dashboard`
  - Patients → `/patient`
  - Others → `/dashboard`

### Admin Users

When a user is authenticated and is an admin:
- Logs success in dev console
- Renders wrapped content

### Loading States

During auth hydration:
- Shows full-screen loader with spinner
- Waits for `authReady` flag from AuthContext
- Prevents flash of unauthorized content

## Props

```typescript
interface AdminRouteProps {
  children: React.ReactNode
  redirectTo?: string // Optional custom redirect destination
}
```

### `children`

The content to render if user is authenticated and is an admin.

### `redirectTo`

Optional custom redirect destination. Defaults to:
- `/login` for unauthenticated users
- User's dashboard for non-admin users

## Development Warnings

In development mode, the component logs helpful warnings:

### Unauthenticated Access

```
[AdminRoute] Unauthenticated access attempt:
{
  pathname: "/admin/dashboard",
  authenticated: false,
  hasUser: false
}
```

### Non-Admin Access

```
[AdminRoute] Non-admin access attempt:
{
  pathname: "/admin/dashboard",
  userRole: "doctor",
  userEmail: "doctor@example.com",
  redirectingTo: "/dashboard"
}
```

### Successful Admin Access

```
[AdminRoute] Admin access granted:
{
  pathname: "/admin/dashboard",
  userEmail: "admin@example.com",
  userId: "abc123"
}
```

## Integration with Existing Admin Pages

### Before (No Protection)

```tsx
"use client"

import { AdminLayout } from "@/components/admin/layout"

export default function AdminDashboardPage() {
  return (
    <AdminLayout>
      <div>Dashboard content</div>
    </AdminLayout>
  )
}
```

### After (With AdminRoute)

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"
import { AdminLayout } from "@/components/admin/layout"

export default function AdminDashboardPage() {
  return (
    <AdminRoute>
      <AdminLayout>
        <div>Dashboard content</div>
      </AdminLayout>
    </AdminRoute>
  )
}
```

## Reusable Admin Page Wrapper

Create a reusable wrapper for consistent admin page structure:

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"
import { AdminLayout } from "@/components/admin/layout"

interface AdminPageWrapperProps {
  children: React.ReactNode
  title?: string
}

function AdminPageWrapper({ children, title }: AdminPageWrapperProps) {
  return (
    <AdminRoute>
      <AdminLayout>
        {title && <h1 className="text-3xl font-bold mb-6">{title}</h1>}
        {children}
      </AdminLayout>
    </AdminRoute>
  )
}

export default AdminPageWrapper
```

Usage:

```tsx
import AdminPageWrapper from "@/components/auth/AdminPageWrapper"

export default function AdminSettingsPage() {
  return (
    <AdminPageWrapper title="Settings">
      <div>Settings content</div>
    </AdminPageWrapper>
  )
}
```

## Applying to All Admin Pages

To protect all admin pages, update each page file:

### `/app/admin/dashboard/page.tsx`

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"
import { AdminLayout } from "@/components/admin/layout"
// ... other imports

export default function AdminDashboardPage() {
  return (
    <AdminRoute>
      <AdminLayout>
        {/* Existing dashboard content */}
      </AdminLayout>
    </AdminRoute>
  )
}
```

### `/app/admin/doctors/page.tsx`

```tsx
"use client"

import { AdminRoute } from "@/components/auth/AdminRoute"
import { AdminLayout } from "@/components/admin/layout"
// ... other imports

export default function AdminDoctorsPage() {
  return (
    <AdminRoute>
      <AdminLayout>
        {/* Existing doctors page content */}
      </AdminLayout>
    </AdminRoute>
  )
}
```

Repeat for all admin pages:
- `/app/admin/patients/page.tsx`
- `/app/admin/appointments/page.tsx`
- `/app/admin/clinics/page.tsx`
- `/app/admin/billing/page.tsx`
- `/app/admin/audit/page.tsx`
- `/app/admin/security/page.tsx`
- `/app/admin/flags/page.tsx`

## Full-Screen Loader

The component shows a full-screen loader during:
- Initial auth hydration
- Session validation
- Redirect processing

The loader includes:
- Spinning icon (Loader2 from lucide-react)
- "Verifying admin access..." message
- Backdrop blur for better visibility

## Security Notes

⚠️ **Important**: This is client-side protection only. Always implement server-side protection as well:

1. **Middleware** - Route-level protection (already implemented)
2. **Server Components** - Use `requireServerAdmin()` from `@/lib/auth/utils`
3. **API Routes** - Use `requireRole('admin')` guards

Client-side protection is for UX and preventing flash of unauthorized content.

## Comparison with Server-Side Protection

### Client-Side (AdminRoute)

- ✅ Prevents flash of unauthorized content
- ✅ Smooth redirects
- ✅ Good UX
- ⚠️ Can be bypassed (don't rely on this alone)

### Server-Side (requireServerAdmin)

- ✅ Cannot be bypassed
- ✅ True security
- ✅ SEO-friendly
- ⚠️ Requires page refresh on redirect

**Best Practice**: Use both together for defense in depth.

## Troubleshooting

### Component Not Redirecting

1. Check that `AuthContext` is properly set up
2. Verify `authReady` is becoming `true`
3. Check browser console for errors
4. Verify middleware is not blocking requests

### Redirect Loop

1. Check that redirect destination is not protected
2. Verify login page is public
3. Check middleware route patterns

### Loader Never Disappears

1. Check `authReady` state in AuthContext
2. Verify API endpoint `/api/auth/me` is working
3. Check browser console for errors

## Related Components

- `<AuthGuard>` - General role-based route protection
- `<PublicOnly>` - Public-only route protection
- `requireServerAdmin()` - Server-side admin helper

## Related Files

- `/components/auth/AdminRoute.tsx` - Component implementation
- `/components/auth/AdminRoute-examples.tsx` - Usage examples
- `/contexts/AuthContext.tsx` - Authentication context
- `/lib/auth/utils.ts` - Server-side admin helper

