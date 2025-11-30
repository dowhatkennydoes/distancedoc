# 🚨 Apply Migration Now - Quick Guide

## Step 1: Apply Migration (REQUIRED)

The migration must be applied before anything else will work.

### Go to Supabase Dashboard:
1. **Open**: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new
2. **Copy** the entire contents of: `scripts/apply-migration-sql.sql`
3. **Paste** into the SQL Editor
4. **Click Run** (or press Cmd/Ctrl + Enter)

### Verify Migration:
After running, verify the columns were added:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'doctors' AND column_name = 'clinic_id';
```

Should return: `clinic_id`

---

## Step 2: Update user_roles

After migration is applied, run:

```bash
npm run update:user-roles
```

Or manually in Supabase SQL Editor:
```sql
UPDATE user_roles 
SET clinic_id = 'default-clinic' 
WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';
```

---

## Step 3: Assign Clinic IDs to Records

```bash
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"
npm run assign:clinics
```

---

## Step 4: Test

```bash
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"
npm run test:tenant
```

---

## Quick Command (All Steps)

```bash
# Set environment
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"

# After migration is applied:
npm run update:user-roles
npm run assign:clinics
npm run test:tenant
```

---

**⚠️ IMPORTANT:** The migration MUST be applied first via Supabase Dashboard before any scripts will work!

