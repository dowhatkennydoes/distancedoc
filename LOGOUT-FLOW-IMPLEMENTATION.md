# Hardened Logout Flow Implementation

## Overview

Implemented a comprehensive, hardened logout flow that handles all edge cases including expired sessions, corrupted cookies, and partial session objects. The logout never fails and always clears state.

## ✅ Requirements Met

1. ✅ **supabase.auth.signOut()** - Called in logout utility
2. ✅ **Clear react auth state** - Uses `setUnauthenticatedState()` helper
3. ✅ **Redirect to /login** - Uses router.push with window.location fallback
4. ✅ **Do not assume user exists** - Never checks for user before logout
5. ✅ **Handle edge cases**:
   - ✅ Expired session
   - ✅ Corrupted cookies
   - ✅ Partial session object

## Implementation

### Files Created/Modified

1. **`/lib/auth/logout.ts`** - New hardened logout utility
   - `performLogout()` - Client-side logout with edge case handling
   - `isValidSession()` - Session validation helper

2. **`/contexts/AuthContext.tsx`** - Updated signOut function
   - Uses `performLogout()` utility
   - Clears React state
   - Redirects to /login

3. **`/app/api/auth/logout/route.ts`** - Hardened API route
   - Handles all edge cases
   - Always clears cookies
   - Never returns errors

## Flow

### Client-Side Logout (AuthContext)

```typescript
const signOut = async () => {
  // 1. Set loading state
  setLoading(true)
  setError(null)

  // 2. Perform hardened logout (handles all edge cases)
  await performLogout()

  // 3. Clear React auth state
  setUnauthenticatedState(...)

  // 4. Redirect to /login
  router.push('/login') // or window.location.href fallback
}
```

### Logout Utility (`performLogout()`)

1. **Check Session** (don't assume it exists)
   - Validates session structure
   - Handles partial/corrupted sessions
   - Checks expiration

2. **Supabase Sign Out**
   - Calls `supabase.auth.signOut()`
   - Handles errors gracefully
   - Continues even if signOut fails

3. **Manual Cookie Clearing**
   - Clears all known Supabase cookie patterns
   - Handles corrupted cookies
   - Multiple path/domain attempts

4. **Server-Side Cleanup**
   - Calls `/api/auth/logout` API
   - Ensures server-side cookie clearing
   - Continues even if API fails

## Edge Cases Handled

### 1. Expired Session

**Problem**: Session expired, but cookies still exist

**Solution**:
```typescript
// Check expiration before sign out
if (session?.expires_at) {
  const now = Math.floor(Date.now() / 1000)
  if (session.expires_at < now) {
    // Session expired - clear anyway
  }
}
```

**Result**: Logout proceeds normally, clears all state and cookies

### 2. Corrupted Cookies

**Problem**: Cookies are malformed or unreadable

**Solution**:
```typescript
// Manual cookie clearing with error handling
cookieNames.forEach(name => {
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
    // Multiple path/domain attempts
  } catch {
    // Ignore individual errors
  }
})
```

**Result**: Cookies cleared even if Supabase couldn't read them

### 3. Partial Session Object

**Problem**: Session object missing required fields

**Solution**:
```typescript
// Validate session structure
if (!session || typeof session !== 'object') {
  // Corrupted - continue with logout
}

if (!session.access_token && !session.refresh_token) {
  // Partial session - clear anyway
}
```

**Result**: Logout proceeds, clears state regardless

### 4. Missing User

**Problem**: User object is null or undefined

**Solution**:
```typescript
// Requirement 4: Do not assume user exists
// Don't check user before logout - just clear state
setUnauthenticatedState(...) // Handles null user
```

**Result**: Logout works even without a user object

### 5. Network Errors

**Problem**: Network failure during signOut or API call

**Solution**:
```typescript
try {
  await supabase.auth.signOut()
} catch {
  // Continue - clear state anyway
}

try {
  await fetch('/api/auth/logout', ...)
} catch {
  // Ignore - client cleanup done
}
```

**Result**: State cleared even if network requests fail

## API Route Behavior

### Success Response

```json
{
  "message": "Signed out successfully",
  "cleared": true
}
```

**Status**: `200`

### Error Response (Still Success)

Even on errors, returns success:

```json
{
  "message": "Logout completed (some cleanup may have failed)",
  "cleared": true,
  "error": "Optional error message"
}
```

**Status**: `200` (never 500!)

## Cookie Clearing Strategy

### Patterns Cleared

1. `sb-access-token`
2. `sb-refresh-token`
3. `sb-{project-ref}-auth-token` (dynamic)

### Methods

1. **Supabase signOut()** - Primary method
2. **Manual cookie clearing** - Fallback for corrupted cookies
3. **API route clearing** - Server-side cleanup
4. **Multiple paths/domains** - Ensures complete clearing

## Usage

### In Components

```tsx
import { useAuth } from '@/contexts/AuthContext'

function LogoutButton() {
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await signOut() // Handles everything automatically
  }

  return <button onClick={handleLogout}>Logout</button>
}
```

### Direct Usage

```typescript
import { performLogout } from '@/lib/auth/logout'

const result = await performLogout()
// result.success - whether logout succeeded
// result.error - any error messages
// result.cleared - whether state was cleared
```

## Error Handling

### Never Throws

All operations wrapped in try/catch:
- Session checks
- Supabase signOut
- Cookie clearing
- API calls
- Redirects

### Always Clears State

Even if errors occur:
- React state is cleared
- Cookies are cleared
- Redirect happens

### Graceful Degradation

If everything fails:
- State is still cleared
- User can manually navigate
- No errors bubble to UI

## Testing Scenarios

### 1. Normal Logout

- User authenticated
- Valid session
- All cookies present

**Expected**: Clean logout, redirect to /login

### 2. Expired Session

- User authenticated
- Session expired
- Cookies still present

**Expected**: Logout proceeds, clears all, redirects

### 3. Corrupted Cookies

- User authenticated
- Cookies malformed
- Cannot read session

**Expected**: Manual cookie clearing, logout proceeds

### 4. No User

- User not authenticated
- No session
- No cookies

**Expected**: State cleared anyway, redirects

### 5. Network Failure

- User authenticated
- Network down
- Cannot reach Supabase

**Expected**: Local cleanup, redirects

## Security Notes

- ✅ **Always clears cookies** - Even on errors
- ✅ **HttpOnly cookies** - Properly cleared
- ✅ **Multiple clear attempts** - Ensures complete cleanup
- ✅ **Server-side cleanup** - API route also clears cookies
- ✅ **No sensitive data exposed** - Errors are generic

## Related Files

- `/lib/auth/logout.ts` - Logout utility
- `/contexts/AuthContext.tsx` - SignOut function
- `/app/api/auth/logout/route.ts` - Logout API route
- `/lib/auth/supabase.ts` - Supabase utilities

## Summary

The hardened logout flow:

1. ✅ Calls `supabase.auth.signOut()`
2. ✅ Clears React auth state
3. ✅ Redirects to `/login`
4. ✅ Never assumes user exists
5. ✅ Handles all edge cases gracefully

**Result**: Logout always succeeds, even in edge cases!

