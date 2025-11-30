# ✅ Tenant Isolation - Complete Setup Instructions

## 🚨 STEP 1: Apply Migration (REQUIRED FIRST)

**This MUST be done before anything else!**

### Quick Steps:
1. **Open**: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new
2. **Open file**: `scripts/apply-migration-now.sql`
3. **Copy** the ENTIRE contents
4. **Paste** into Supabase SQL Editor
5. **Click Run** (or Cmd/Ctrl + Enter)

### What it does:
- ✅ Adds `clinic_id` column to all tables
- ✅ Creates indexes for performance
- ✅ Updates existing `user_roles` with clinic IDs
- ✅ Verifies migration success

**Expected result:** All 6 tables should show `has_clinic_id: true`

---

## ✅ STEP 2: Run Complete Setup

After migration is applied, run:

```bash
npm run setup:tenant
```

This will:
1. ✅ Verify migration was applied
2. ✅ Update user_roles (if needed)
3. ✅ Assign clinic IDs to all Prisma records
4. ✅ Run tests

---

## 📋 Manual Steps (if scripts fail)

### Update user_roles:
```sql
UPDATE user_roles 
SET clinic_id = 'default-clinic' 
WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';
```

### Assign Clinic IDs to Records:
```bash
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"
npm run assign:clinics
```

### Test:
```bash
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"
npm run test:tenant
```

---

## 🎯 Quick Command Reference

```bash
# Apply migration (manual - via Supabase Dashboard)
# Then run:
npm run setup:tenant

# Or individual steps:
npm run update:user-roles
npm run assign:clinics
npm run test:tenant
```

---

## ✅ Verification

After setup, verify:

1. **Migration Applied:**
   ```sql
   SELECT column_name 
   FROM information_schema.columns 
   WHERE table_name = 'doctors' AND column_name = 'clinic_id';
   ```
   Should return: `clinic_id`

2. **Records Have Clinic IDs:**
   ```sql
   SELECT clinic_id, COUNT(*) 
   FROM doctors 
   GROUP BY clinic_id;
   ```
   Should show records with clinic IDs

3. **Indexes Created:**
   ```sql
   SELECT indexname 
   FROM pg_indexes 
   WHERE tablename = 'doctors' AND indexname LIKE '%clinic%';
   ```
   Should show multiple clinic indexes

---

## 🎉 Done!

Once complete, tenant isolation is active:
- ✅ All queries scoped by `clinicId`
- ✅ Doctors can only access their clinic's data
- ✅ Middleware validates clinic access
- ✅ All API routes enforce clinic scoping

---

**Files:**
- `scripts/apply-migration-now.sql` - Migration SQL (apply first!)
- `scripts/run-complete-setup.sh` - Complete setup script
- `APPLY-MIGRATION-NOW.md` - Quick reference

