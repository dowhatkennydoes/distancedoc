# Tenant Isolation Setup Guide

This guide walks you through completing the tenant isolation implementation.

## Step 1: Run Database Migration

Apply the migration to add `clinicId` columns to all relevant tables.

### Option A: Using Supabase CLI (Recommended)

```bash
# If using Supabase CLI
npm run migrate:tenant

# Or manually
supabase db push
# or
supabase migration up
```

### Option B: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `supabase/migrations/002_add_clinic_id.sql`
4. Copy and paste the SQL into the editor
5. Click **Run**

### Verify Migration

After running the migration, verify the columns were added:

```sql
-- Check user_roles
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_roles' AND column_name = 'clinic_id';

-- Check doctors
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'doctors' AND column_name = 'clinic_id';

-- Check patients
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'patients' AND column_name = 'clinic_id';
```

## Step 2: Assign Clinic IDs to Existing Records

### Update user_roles in Supabase

First, update the `user_roles` table in Supabase (this table is managed by Supabase, not Prisma):

```sql
-- Assign default clinic to all existing users
UPDATE user_roles 
SET clinic_id = 'default-clinic' 
WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';

-- Or assign specific clinic IDs based on your logic
-- Example: Assign based on user email domain
UPDATE user_roles 
SET clinic_id = CASE 
  WHEN user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@clinic1.com') 
  THEN 'clinic-1'
  WHEN user_id IN (SELECT id FROM auth.users WHERE email LIKE '%@clinic2.com') 
  THEN 'clinic-2'
  ELSE 'default-clinic'
END
WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';
```

### Run Assignment Script

Assign clinic IDs to all Prisma-managed records:

```bash
# Assign default clinic to all records
npm run assign:clinics

# Or assign a specific clinic ID
npx tsx scripts/assign-clinic-ids.ts clinic-1
```

The script will:
- ✅ Update doctors with clinic IDs
- ✅ Update patients with clinic IDs
- ✅ Update appointments with clinic IDs (based on doctor's clinic)
- ✅ Update visit notes with clinic IDs (based on doctor's clinic)
- ✅ Update message threads with clinic IDs (based on doctor's clinic)

## Step 3: Test Tenant Isolation

Run the test suite to verify tenant isolation is working:

```bash
npm run test:tenant
```

The test suite verifies:
- ✅ Clinic scoping in queries
- ✅ Database indexes
- ✅ `withClinicScope` helper
- ✅ `verifyClinicAccess` function
- ✅ Session includes `clinicId`
- ✅ Middleware clinic validation

## Step 4: Manual Testing

### Test 1: Verify Clinic Scoping in API

1. **Create test users in different clinics:**
   ```sql
   -- In Supabase SQL Editor
   INSERT INTO user_roles (user_id, role, clinic_id, approved)
   VALUES 
     ('user-1-uuid', 'doctor', 'clinic-1', true),
     ('user-2-uuid', 'doctor', 'clinic-2', true);
   ```

2. **Test API endpoint:**
   - Login as doctor from clinic-1
   - Try to access `/api/doctor/profile`
   - Verify only clinic-1 data is returned

3. **Test cross-clinic access denial:**
   - Login as doctor from clinic-1
   - Try to access a patient from clinic-2
   - Should receive 403 Forbidden

### Test 2: Verify Database Queries

```typescript
// This should only return doctors from clinic-1
const doctors = await prisma.doctor.findMany({
  where: {
    clinicId: 'clinic-1',
  },
})

// This should fail or return empty
const crossClinicDoctors = await prisma.doctor.findMany({
  where: {
    clinicId: 'clinic-2',
    // User from clinic-1 should not see these
  },
})
```

### Test 3: Verify Middleware

1. **Test missing clinicId:**
   - Create a user without `clinicId` in `user_roles`
   - Try to access any protected route
   - Should be redirected to login with error: `clinic_not_assigned`

2. **Test valid clinicId:**
   - Login as user with valid `clinicId`
   - Access protected routes
   - Should work normally

## Step 5: Update Application Code

### Ensure New Records Include clinicId

When creating new records, always include `clinicId`:

```typescript
// ✅ Good - includes clinicId
const appointment = await prisma.appointment.create({
  data: {
    doctorId: doctor.id,
    patientId: patient.id,
    clinicId: session.clinicId, // Always include
    scheduledAt: new Date(),
    // ...
  },
})

// ❌ Bad - missing clinicId
const appointment = await prisma.appointment.create({
  data: {
    doctorId: doctor.id,
    patientId: patient.id,
    // Missing clinicId!
    scheduledAt: new Date(),
  },
})
```

### Update Signup Flow

Ensure new users are assigned to a clinic during signup:

```typescript
// In signup API route
const clinicId = determineClinicId(userEmail) // Your logic here

await supabase.from('user_roles').insert({
  user_id: user.id,
  role: 'doctor',
  clinic_id: clinicId, // Assign clinic
  approved: false,
})
```

## Troubleshooting

### Issue: Migration fails with "column already exists"

**Solution:** The migration uses `IF NOT EXISTS`, so this is safe. The column may have been added manually.

### Issue: Records show `null` for clinicId

**Solution:** Run the assignment script:
```bash
npm run assign:clinics
```

### Issue: Users can still access cross-clinic data

**Solution:** 
1. Verify all API routes use `withClinicScope()`
2. Check that `session.clinicId` is being loaded correctly
3. Verify middleware is validating `clinicId`

### Issue: Migration script fails

**Solution:**
1. Check database connection string in `.env`
2. Verify Prisma client is generated: `npx prisma generate`
3. Check database permissions

## Verification Checklist

- [ ] Migration applied successfully
- [ ] All tables have `clinicId` column
- [ ] All indexes created
- [ ] `user_roles` table updated with clinic IDs
- [ ] All existing records have clinic IDs assigned
- [ ] Test suite passes
- [ ] Manual testing confirms isolation
- [ ] New records include `clinicId`
- [ ] Signup flow assigns clinic IDs

## Next Steps

1. **Monitor Logs:** Watch for `CLINIC_ACCESS_DENIED` audit logs
2. **Set Up Alerts:** Alert on cross-clinic access attempts
3. **Document Clinic Assignment:** Document how clinics are assigned to users
4. **Multi-Clinic Support:** If supporting multiple clinics, implement clinic selection UI

---

**Status:** ✅ Setup scripts and documentation complete

**Files:**
- ✅ `scripts/run-migration.sh` - Migration runner
- ✅ `scripts/assign-clinic-ids.ts` - Clinic ID assignment
- ✅ `scripts/test-tenant-isolation.ts` - Test suite
- ✅ `TENANT-ISOLATION-SETUP.md` - This guide

