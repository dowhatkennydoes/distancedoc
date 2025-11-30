# ✅ Apply Migration - Simple 2-Step Process

## Why It's Taking Long
Supabase **blocks** programmatic DDL execution for security. The migration **must** be applied manually via the Dashboard SQL Editor. This is by design.

## Quick Solution (2 minutes)

### Step 1: Copy SQL
Open this file and copy ALL contents:
```
supabase/migrations/002_add_clinic_id.sql
```

### Step 2: Paste & Run
1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new
2. Paste the SQL
3. Click **Run**

**Done!** ✅

---

## After Migration

Run:
```bash
npm run update:user-roles
npm run assign:clinics
```

That's it! No more automation attempts needed.

