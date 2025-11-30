# Authentication System

DistanceDoc uses Supabase for authentication with role-based access control.

## Features

- ✅ Patient self-registration
- ✅ Doctor signup with admin approval
- ✅ Session-based authentication
- ✅ Route protection middleware
- ✅ API route protection utilities
- ✅ React context provider

## Structure

### Client-Side
- `contexts/AuthContext.tsx` - React context provider for authentication state
- `lib/supabase/client.ts` - Supabase client for browser usage

### Server-Side
- `lib/supabase/server.ts` - Supabase client for server components/API routes
- `lib/supabase/middleware.ts` - Supabase client for Next.js middleware
- `lib/auth/utils.ts` - Server-side auth utility functions
- `lib/auth/api-protection.ts` - API route protection utilities
- `lib/auth/types.ts` - TypeScript types for authentication

### API Routes
- `/api/auth/signup` - User registration
- `/api/auth/login` - User login
- `/api/auth/logout` - User logout
- `/api/auth/session` - Get current session
- `/api/auth/approve-doctor` - Admin endpoint to approve doctors

### Pages
- `/login` - Login page
- `/signup` - Signup page (patient/doctor)
- `/doctor/pending` - Doctor approval pending page

## Usage

### Client Component
```tsx
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { user, loading, signOut } = useAuth()
  
  if (loading) return <div>Loading...</div>
  if (!user) return <div>Not logged in</div>
  
  return <div>Welcome, {user.email}</div>
}
```

### API Route
```tsx
import { withAuth } from '@/lib/auth/api-protection'

export const GET = withAuth(
  async (request, user) => {
    // user is authenticated
    return NextResponse.json({ data: 'protected' })
  },
  { roles: ['doctor'], requireApproval: true }
)
```

### Server Component
```tsx
import { getCurrentUser } from '@/lib/auth/utils'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <div>Welcome, {user.email}</div>
}
```

## Setup

1. Create Supabase project
2. Run SQL migration: `supabase/migrations/001_user_roles.sql`
3. Add environment variables to `.env`
4. Install dependencies: `npm install`

See `docs/SUPABASE-SETUP.md` for detailed instructions.

