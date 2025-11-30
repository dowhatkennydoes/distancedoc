# Supabase Authentication Setup

## Overview

DistanceDoc uses Supabase for authentication with role-based access control. The system supports two main roles: **doctor** and **patient**, with an additional **admin** role for account management.

## Features

- ✅ Patient self-registration
- ✅ Doctor signup with admin approval requirement
- ✅ Session-based authentication
- ✅ Route protection middleware
- ✅ API route protection utilities
- ✅ React context provider for client-side auth

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # For admin operations
```

### 3. Create Database Tables

Run this SQL in your Supabase SQL Editor:

```sql
-- User roles table
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'patient', 'admin')),
  approved BOOLEAN DEFAULT false,
  doctor_id TEXT,  -- References Prisma doctors.id
  patient_id TEXT,  -- References Prisma patients.id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_roles_approved ON user_roles(approved);

-- Enable Row Level Security
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can read their own role
CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (for API operations)
CREATE POLICY "Service role full access"
  ON user_roles FOR ALL
  USING (auth.role() = 'service_role');
```

### 4. Set Up Email Templates (Optional)

Configure email templates in Supabase Dashboard:
- Email confirmation
- Password reset
- Magic link (if using)

## Authentication Flow

### Patient Signup

1. Patient fills out signup form with email, password, date of birth
2. User created in Supabase Auth
3. User role record created with `approved = true`
4. Patient profile created in Prisma database
5. Patient can immediately log in

### Doctor Signup

1. Doctor fills out signup form with email, password, license number, NPI
2. User created in Supabase Auth
3. User role record created with `approved = false`
4. Doctor profile created in Prisma database
5. Doctor cannot log in until admin approves
6. Admin approves via `/api/auth/approve-doctor` endpoint
7. Doctor receives notification and can log in

## API Endpoints

### POST `/api/auth/signup`
Sign up a new user (patient or doctor)

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "role": "patient" | "doctor",
  // For doctors:
  "licenseNumber": "MD12345",
  "npiNumber": "1234567890",
  "specialization": "Cardiology",
  // For patients:
  "dateOfBirth": "1990-01-01",
  "phoneNumber": "+1234567890"
}
```

### POST `/api/auth/login`
Log in a user

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### POST `/api/auth/logout`
Log out current user

### GET `/api/auth/session`
Get current user session

### POST `/api/auth/approve-doctor` (Admin only)
Approve or revoke doctor account

**Request:**
```json
{
  "doctorId": "user-uuid",
  "approved": true
}
```

## Usage Examples

### Client-Side (React Components)

```tsx
import { useAuth } from '@/contexts/AuthContext'

function MyComponent() {
  const { user, loading, signOut } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Not logged in</div>

  return (
    <div>
      <p>Welcome, {user.email}</p>
      <p>Role: {user.role}</p>
      {user.role === 'doctor' && (
        <p>Approved: {user.metadata?.approved ? 'Yes' : 'Pending'}</p>
      )}
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

### Server-Side (API Routes)

```tsx
import { withAuth } from '@/lib/auth/api-protection'

export const GET = withAuth(
  async (request, user) => {
    // user is guaranteed to be authenticated
    return NextResponse.json({ data: 'protected data' })
  },
  {
    roles: ['doctor', 'patient'], // Optional role restriction
    requireApproval: true, // For doctors, require approval
  }
)
```

### Server Components

```tsx
import { getCurrentUser } from '@/lib/auth/utils'

export default async function ServerComponent() {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }

  return <div>Welcome, {user.email}</div>
}
```

## Route Protection

Routes are automatically protected by middleware:

- `/doctor/*` - Requires doctor role and approval
- `/patient/*` - Requires patient role
- `/admin/*` - Requires admin role
- `/dashboard/*` - Requires authentication

Unauthenticated users are redirected to `/login`.

## Security Considerations

1. **Row Level Security**: Enabled on `user_roles` table
2. **Password Requirements**: Minimum 8 characters (enforced by Supabase)
3. **Session Management**: Handled by Supabase with automatic refresh
4. **Role Validation**: Checked on both client and server
5. **Doctor Approval**: Required before doctors can access protected routes

## Next Steps

1. Set up Supabase project and configure environment variables
2. Run the SQL migration to create `user_roles` table
3. Configure email templates in Supabase Dashboard
4. Test signup and login flows
5. Set up admin user for doctor approvals

