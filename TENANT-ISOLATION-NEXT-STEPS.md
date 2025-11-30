# 🎯 Tenant Isolation - Next Steps Checklist

## Immediate Actions Required

### ✅ Step 1: Apply Database Migration

**Choose one method:**

#### Method A: Supabase Dashboard (Easiest)
1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv
2. Click **SQL Editor** in left sidebar
3. Click **New Query**
4. Open file: `scripts/apply-migration-sql.sql`
5. Copy entire contents
6. Paste into SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Verify success message

#### Method B: Supabase CLI
```bash
# If linked to project
supabase db push

# Or apply specific migration
supabase migration up
```

**Verification:**
```sql
-- Run this in SQL Editor to verify
SELECT 
  'user_roles' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns 
         WHERE table_name = 'user_roles' AND column_name = 'clinic_id') as has_clinic_id
UNION ALL
SELECT 'doctors', EXISTS(SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'doctors' AND column_name = 'clinic_id')
UNION ALL
SELECT 'patients', EXISTS(SELECT 1 FROM information_schema.columns 
                          WHERE table_name = 'patients' AND column_name = 'clinic_id')
UNION ALL
SELECT 'appointments', EXISTS(SELECT 1 FROM information_schema.columns 
                             WHERE table_name = 'appointments' AND column_name = 'clinic_id')
UNION ALL
SELECT 'visit_notes', EXISTS(SELECT 1 FROM information_schema.columns 
                             WHERE table_name = 'visit_notes' AND column_name = 'clinic_id')
UNION ALL
SELECT 'message_threads', EXISTS(SELECT 1 FROM information_schema.columns 
                                  WHERE table_name = 'message_threads' AND column_name = 'clinic_id');
```

All should return `true`.

---

### ✅ Step 2: Update user_roles Table

**In Supabase SQL Editor, run:**

```sql
-- Assign default clinic to all existing users
UPDATE user_roles 
SET clinic_id = 'default-clinic' 
WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';

-- Verify update
SELECT COUNT(*) as total_users,
       COUNT(CASE WHEN clinic_id IS NOT NULL THEN 1 END) as users_with_clinic
FROM user_roles;
```

**Expected:** All users should have `clinic_id` set.

---

### ✅ Step 3: Assign Clinic IDs to Prisma Records

```bash
# Run the assignment script
npm run assign:clinics

# Or with specific clinic ID
npx tsx scripts/assign-clinic-ids.ts clinic-1
```

**What it does:**
- Updates all doctors with clinic IDs
- Updates all patients with clinic IDs
- Updates all appointments (based on doctor's clinic)
- Updates all visit notes (based on doctor's clinic)
- Updates all message threads (based on doctor's clinic)

**Expected output:**
```
✅ Updated X doctors
✅ Updated X patients
✅ Updated X appointments
✅ Updated X visit notes
✅ Updated X message threads
```

---

### ✅ Step 4: Test Tenant Isolation

```bash
# Run test suite
npm run test:tenant
```

**Expected:** All tests should pass ✅

---

### ✅ Step 5: Manual Verification

#### Test 1: Verify Clinic Scoping Works

1. **Create test data:**
   ```sql
   -- In Supabase SQL Editor
   -- Create two doctors in different clinics
   INSERT INTO user_roles (user_id, role, clinic_id, approved)
   VALUES 
     (gen_random_uuid(), 'doctor', 'clinic-1', true),
     (gen_random_uuid(), 'doctor', 'clinic-2', true);
   ```

2. **Test API:**
   - Login as doctor from clinic-1
   - Access `/api/doctor/profile`
   - Should only see clinic-1 data

3. **Test cross-clinic denial:**
   - Login as doctor from clinic-1
   - Try to access patient from clinic-2
   - Should receive 403 Forbidden

#### Test 2: Verify Database Queries

```typescript
// In your API route or test
const session = await requireSession(request)

// This should only return doctors from user's clinic
const doctors = await prisma.doctor.findMany({
  where: {
    clinicId: session.clinicId, // ✅ Enforced
  },
})
```

---

## Quick Reference

### NPM Scripts
```bash
npm run migrate:tenant    # Run migration
npm run assign:clinics    # Assign clinic IDs
npm run test:tenant      # Test isolation
```

### SQL Commands
```sql
-- Check migration status
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'doctors' AND column_name = 'clinic_id';

-- Update user_roles
UPDATE user_roles SET clinic_id = 'default-clinic' 
WHERE clinic_id IS NULL;

-- Verify records
SELECT clinic_id, COUNT(*) FROM doctors GROUP BY clinic_id;
```

### Key Files
- `supabase/migrations/002_add_clinic_id.sql` - Migration file
- `scripts/apply-migration-sql.sql` - Standalone SQL
- `scripts/assign-clinic-ids.ts` - Assignment script
- `scripts/test-tenant-isolation.ts` - Test suite
- `lib/auth/tenant-scope.ts` - Tenant utilities

---

## Troubleshooting

### Migration fails
- Check Supabase project is linked: `supabase status --linked`
- Verify SQL syntax in migration file
- Check database permissions

### Records show null clinicId
- Run: `npm run assign:clinics`
- Check Prisma connection string
- Verify migration was applied

### Tests fail
- Ensure migration is applied
- Ensure clinic IDs are assigned
- Check Prisma client is generated: `npx prisma generate`

### Users can access cross-clinic data
- Verify all API routes use `withClinicScope()`
- Check `session.clinicId` is loaded
- Verify middleware validates `clinicId`

---

## Status

✅ **Implementation Complete**
- All code updated
- All scripts created
- All documentation written

⏳ **Remaining:**
1. Apply migration (5 minutes)
2. Assign clinic IDs (2 minutes)
3. Test (5 minutes)

**Total time: ~15 minutes**

---

**Ready to complete!** Follow the steps above to finish setup. 🚀

