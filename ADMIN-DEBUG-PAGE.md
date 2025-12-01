# Admin Debug Page Documentation

## Overview

Created `/admin/debug` page for verifying authentication and session state, especially the unauthenticated flow. This page is **development-only** and provides comprehensive debug information.

## ✅ Requirements Met

1. ✅ **Page must load even if no user is logged in** - Shows null/empty states gracefully
2. ✅ **Never error on null state** - All null checks in place
3. ✅ **Only show debug data in dev environment** - Checks `NODE_ENV === "development"`

## Features

The debug page displays:

- ✅ **authenticated** - Boolean auth status
- ✅ **user** - Full user object or null
- ✅ **role** - User role (doctor/patient/admin)
- ✅ **clinicId** - User's clinic identifier
- ✅ **token age** - Time since token was issued
- ✅ **session expiration** - Time until session expires

## Location

**File**: `/app/admin/debug/page.tsx`

**URL**: `http://localhost:3000/admin/debug` (dev only)

## Access

⚠️ **Important**: This page is under `/admin/` which means middleware will redirect unauthenticated users to `/login`.

To verify the unauth flow:

### Option 1: Access as Admin
1. Log in as admin
2. Navigate to `/admin/debug`
3. Check the debug data

### Option 2: Bypass Middleware (Dev Only)
Temporarily access via browser DevTools:
1. Open Network tab
2. Intercept the redirect request
3. Or use a direct API call to see unauth state

### Option 3: Make Public (Recommended for Debug)
Update middleware to allow `/admin/debug` in development:

```typescript
// In middleware.ts, add to PUBLIC_ROUTES in dev:
if (process.env.NODE_ENV === 'development') {
  PUBLIC_ROUTES.push('/admin/debug')
}
```

## Display Sections

### 1. Authentication State
- `authenticated`: Boolean
- `loading`: Boolean
- `authReady`: Boolean  
- `error`: String or null

### 2. User Information
- User ID
- Email
- Role
- Clinic ID
- Email Verified status
- Metadata (JSON)

### 3. Session Information
- Expiration date/time
- Time until expiration
- Expires in (seconds)
- Token age
- Token type
- Access token preview (first 20 chars)
- Refresh token preview (first 20 chars)
- Raw expiration timestamp

### 4. Raw Data
- Full user object (JSON)
- Full session info (JSON)

### 5. Unauth Flow Verification
Checklist for verifying unauthenticated state:
- ✓ Unauthenticated state detected correctly
- ✓ User is null (not undefined)
- ✓ No session when unauthenticated
- ✓ No errors in unauthenticated state

## Development-Only Protection

The page checks `process.env.NODE_ENV === "development"`:

```tsx
if (!isDevelopment()) {
  return (
    <div>Debug information is only available in development mode</div>
  )
}
```

In production, shows a message that debug is disabled.

## Null Safety

All data access is null-safe:

```tsx
// Never assumes user exists
{user ? (
  <div>User data here</div>
) : (
  <p>No user logged in</p>
)}

// Never assumes session exists
{sessionInfo ? (
  <div>Session data here</div>
) : (
  <p>No session available</p>
)}
```

## Example Output

### Authenticated Admin

```
Authentication State:
- Authenticated: Yes
- Loading: No
- Auth Ready: Yes
- Error: None

User Information:
- ID: abc123...
- Email: admin@example.com
- Role: admin
- Clinic ID: clinic-001

Session Information:
- Expiration Date: Dec 15, 2024 10:30 AM
- Time Until Expiration: Expires in 2 hours
- Expires In: 7200s
- Token Age: issued 6 hours ago
```

### Unauthenticated State

```
Authentication State:
- Authenticated: No
- Loading: No
- Auth Ready: Yes
- Error: None

User Information:
- No user logged in

Session Information:
- No session available

Unauth Flow Verification:
✓ Unauthenticated state detected correctly
✓ User is null (not undefined)
✓ No session when unauthenticated
✓ No errors in unauthenticated state
```

## Using to Verify Unauth Flow

1. **Clear cookies/session** (DevTools → Application → Cookies → Clear)
2. **Navigate to** `/admin/debug` (will redirect to login)
3. **Or access after logging out** to see unauth state
4. **Check the verification checklist** at the bottom
5. **Verify all states show correctly**:
   - `authenticated: false`
   - `user: null`
   - `session: null`
   - `error: null`

## Security Notes

- ⚠️ **Development Only** - Never deploy this page to production
- 🔒 **Contains sensitive data** - Tokens, user IDs, etc.
- 🚫 **Should be restricted** - Consider adding IP whitelist or additional auth
- 🛡️ **Never expose in production** - The page checks `NODE_ENV` but be cautious

## Troubleshooting

### Page redirects to login
- Middleware is protecting `/admin/debug`
- Either log in first, or add exception in middleware for dev

### No session info shown
- User is not authenticated
- Session expired
- Cookies not set properly

### Token age shows "Unknown"
- Session doesn't have `expires_at` or `expires_in`
- Token structure might be different than expected

## Related Files

- `/app/admin/debug/page.tsx` - Debug page component
- `/contexts/AuthContext.tsx` - Auth context provider
- `/lib/supabase/client.ts` - Supabase client for session access
- `/middleware.ts` - Route protection (may need exception)

## Future Enhancements

1. Add middleware exception for `/admin/debug` in dev
2. Add IP whitelist for additional security
3. Add ability to manually trigger auth state changes
4. Add network request viewer for auth API calls
5. Add cookie inspector

