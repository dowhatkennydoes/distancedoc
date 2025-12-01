# Seed Doctors Script

This script creates three demo doctors in Supabase Auth and the Prisma database.

## Features

- Creates 3 demo doctors with realistic data
- Stores user profile information (firstName, lastName, phone) in Supabase Auth user metadata
- Creates Doctor records in Prisma database
- Sets up user_roles entries with `role="doctor"` and `clinicId="demo-clinic-001"`
- Includes all required fields: firstName, lastName, email, phone, specialty, bio, avatarUrl
- Handles existing users (updates instead of failing)

## Prerequisites

1. **Environment Variables** - Set these in `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://vhwvejtjrajjsluutrqv.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=your-database-url
   ```

2. **Dependencies** - Ensure these packages are installed:
   ```bash
   npm install @supabase/supabase-js @prisma/client
   ```

## Usage

### Run the script:
```bash
npx tsx scripts/seedDoctors.ts
```

Or with ts-node:
```bash
npx ts-node scripts/seedDoctors.ts
```

## What Gets Created

### 1. Supabase Auth Users
Three users are created in Supabase Auth:
- `doctor1@example.com` - Dr. Sarah Johnson (Cardiology)
- `doctor2@example.com` - Dr. Michael Chen (Pediatrics)
- `doctor3@example.com` - Dr. Emily Rodriguez (Dermatology)

Each user has:
- Email and password authentication
- User metadata: firstName, lastName, phone, specialty, avatarUrl

### 2. User Roles
Each user gets a `user_roles` entry with:
- `role`: "doctor"
- `approved`: true
- `clinicId`: "demo-clinic-001"
- `doctor_id`: Reference to Prisma Doctor record

### 3. Doctor Records (Prisma)
Each doctor gets a record in the `doctors` table with:
- `userId`: Links to Supabase Auth user
- `clinicId`: "demo-clinic-001"
- `licenseNumber`: Unique license number
- `npiNumber`: National Provider Identifier
- `specialization`: Medical specialty
- `bio`: Professional biography
- `credentials`: ["MD"]
- `languages`: ["English"]
- `timezone`: "America/New_York"

## Login Credentials

After running the script, you can log in with:

| Email | Password | Specialty |
|-------|----------|-----------|
| doctor1@example.com | password123 | Cardiology |
| doctor2@example.com | password123 | Pediatrics |
| doctor3@example.com | password123 | Dermatology |

## Data Stored

### In Supabase Auth (user_metadata):
- `firstName`
- `lastName`
- `phone`
- `specialty`
- `avatarUrl`
- `role`: "doctor"

### In Prisma Doctor Model:
- `userId` (UUID)
- `clinicId`: "demo-clinic-001"
- `licenseNumber`
- `npiNumber`
- `specialization`
- `bio`
- `credentials`: ["MD"]
- `languages`: ["English"]
- `timezone`: "America/New_York"
- `createdAt` (automatic)
- `updatedAt` (automatic)

## Notes

1. **Idempotent**: The script is safe to run multiple times. It will update existing users/doctors instead of failing.

2. **Auto-approval**: All doctors are created with `approved: true`, so they can log in immediately.

3. **Demo Clinic**: All doctors are assigned to `demo-clinic-001` for tenant isolation testing.

4. **Avatar URLs**: Uses placeholder avatar URLs from dicebear.com API.

## Troubleshooting

### Error: Missing environment variables
- Ensure `.env.local` exists with required variables
- Check that `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are set

### Error: User already exists
- The script handles this automatically by updating existing users
- If you want to start fresh, delete users manually from Supabase Dashboard

### Error: Database connection failed
- Verify `DATABASE_URL` is correct
- Check that Prisma migrations have been run
- Ensure database is accessible

## Example Output

```
🌱 Starting Doctor Seeding Process
==================================================

Clinic ID: demo-clinic-001
Supabase URL: https://vhwvejtjrajjsluutrqv.supabase.co
Database: Connected

📋 Creating doctor: doctor1@example.com
   1. Creating user in Supabase Auth...
   ✅ User created: abc123...
   2. Creating/updating user_roles entry...
   ✅ Created user_roles entry
   3. Creating/updating Doctor record in database...
   ✅ Created Doctor record

✅ Successfully created/updated doctor: doctor1@example.com
   - User ID: abc123...
   - Doctor ID: xyz789...
   - Name: Sarah Johnson
   - Specialty: Cardiology
   - Clinic ID: demo-clinic-001

[... continues for all 3 doctors ...]

==================================================
📊 Seeding Summary
==================================================

✅ Successful: 3
   - doctor1@example.com
   - doctor2@example.com
   - doctor3@example.com

==================================================
🎉 Seeding process completed!

You can now log in with these credentials:
  Email: doctor1@example.com | Password: password123
  Email: doctor2@example.com | Password: password123
  Email: doctor3@example.com | Password: password123

All doctors are assigned to clinic: demo-clinic-001
```

