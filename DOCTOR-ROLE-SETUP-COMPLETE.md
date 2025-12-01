# Doctor Role Setup - Complete

## Overview

The `seedDoctors.ts` script has been updated to ensure that each doctor user has `role="doctor"` properly configured in all necessary locations for the login flow to detect them correctly.

## Role Configuration

### 1. User Metadata (user_metadata.role)

The script explicitly sets `role: 'doctor'` in `user_metadata` when creating or updating Supabase Auth users:

```typescript
user_metadata: {
  firstName,
  lastName,
  phone,
  specialty,
  avatarUrl,
  role: 'doctor', // Explicitly set for login detection
}
```

**Location**: Supabase Auth user record  
**Accessible via**: `user.user_metadata.role`  
**Purpose**: Quick role lookup and JWT claims inclusion

### 2. User Roles Table (user_roles.role)

The script creates/updates a record in the `user_roles` table with:

```typescript
{
  user_id: userId,
  role: 'doctor',
  approved: true,
  clinicId: CLINIC_ID,
  doctor_id: doctorId
}
```

**Location**: PostgreSQL `user_roles` table  
**Accessible via**: Database query from `user_roles` table  
**Purpose**: Primary source of truth for role-based access control

### 3. JWT Claims

Supabase automatically includes `user_metadata` in JWT claims. Since `role: 'doctor'` is set in `user_metadata`, it will be available in JWT tokens as `user_metadata.role`.

**Note**: The login flow primarily checks the `user_roles` table (line 72-76 in `app/api/auth/login/route.ts`), but having it in `user_metadata` ensures consistency and provides quick access.

## Login Flow Detection

The login flow (`app/api/auth/login/route.ts`) will detect doctors by:

1. **Authenticating** the user with Supabase Auth
2. **Querying** the `user_roles` table for the user's role
3. **Building** the full user object with role information
4. **Checking** approval status for doctors

Since the script sets:
- ✅ `role='doctor'` in `user_metadata`
- ✅ `role='doctor'` in `user_roles` table
- ✅ `approved=true` in `user_roles` table
- ✅ `doctor_id` linked in `user_roles` table

The login flow will correctly identify and authenticate all seeded doctors.

## Output Summary

After seeding, the script prints detailed credentials for each doctor:

```
📋 DOCTOR CREDENTIALS
==================================================

👨‍⚕️  Doctor 1:
   Email:      doctor1@example.com
   Password:   password123
   Doctor ID:  cmim6g9d...
   Specialty:  Internal Medicine
   Role:       doctor (set in user_metadata and user_roles)

👨‍⚕️  Doctor 2:
   Email:      doctor2@example.com
   Password:   password123
   Doctor ID:  cmim6gae...
   Specialty:  Dermatology
   Role:       doctor (set in user_metadata and user_roles)

👨‍⚕️  Doctor 3:
   Email:      doctor3@example.com
   Password:   password123
   Doctor ID:  cmim6gbs...
   Specialty:  Psychiatry
   Role:       doctor (set in user_metadata and user_roles)
```

## Verification Checklist

After running the script, verify:

- ✅ Each doctor has `role='doctor'` in `user_metadata`
- ✅ Each doctor has a record in `user_roles` with `role='doctor'`
- ✅ Each doctor has `approved=true` in `user_roles`
- ✅ Each doctor has `doctor_id` linked in `user_roles`
- ✅ Each doctor can log in and is detected as a doctor

## Usage

Run the script:

```bash
npx tsx scripts/seedDoctors.ts
```

The script will:
1. Create/update 3 doctors
2. Set role in `user_metadata`
3. Set role in `user_roles` table
4. Create 5 demo patients
5. Create 6 appointments
6. Print detailed credentials summary

