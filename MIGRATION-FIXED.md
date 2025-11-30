# ✅ Supabase CLI Migration - Fixed

## Issue
Supabase CLI was having authentication issues with direct database connections. The database requires connection pooling or SSL, and direct TCP connections are restricted.

## Solution
Since Supabase restricts direct database connections, the migration must be applied via the **Supabase Dashboard SQL Editor**.

## Quick Apply (2 minutes)

### Step 1: Apply Migration
1. **Open**: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new
2. **Open file**: `supabase/migrations/002_add_clinic_id.sql`
3. **Copy** entire contents
4. **Paste** into SQL Editor
5. **Click Run** (or Cmd/Ctrl + Enter)

### Step 2: Run Setup
```bash
npm run migrate:tenant
```

This will:
- ✅ Verify migration was applied
- ✅ Update user_roles
- ✅ Provide instructions for assigning clinic IDs

## Alternative: Manual SQL

If scripts fail, run these SQL statements in Supabase Dashboard:

```sql
-- Apply migration (from 002_add_clinic_id.sql)
-- Copy entire file contents

-- Then update user_roles
UPDATE user_roles 
SET clinic_id = 'default-clinic' 
WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';
```

## Verification

After migration, verify:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'doctors' AND column_name = 'clinic_id';
```

Should return: `clinic_id`

## Status

✅ **Migration script fixed** - Uses Supabase Dashboard approach
✅ **Setup script ready** - `npm run migrate:tenant`
✅ **All files prepared** - Ready to apply

---

**Next**: Apply migration in Dashboard, then run `npm run migrate:tenant`

