# Apply Doctor Dashboard Preview Migration

## Migration File Created

✅ **Migration file created**: `supabase/migrations/004_add_doctor_dashboard_preview.sql`

## Apply via Supabase Dashboard

Since direct database connection requires special setup, apply the migration via the Supabase Dashboard:

### Steps:

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv
   - Navigate to **SQL Editor**

2. **Open the migration file**
   - Location: `supabase/migrations/004_add_doctor_dashboard_preview.sql`
   - Copy the entire contents

3. **Paste and Run**
   - Paste the SQL into the SQL Editor
   - Click **Run** to execute

4. **Verify**
   - Check that the table `doctor_dashboard_preview` was created
   - Verify indexes and foreign keys are in place

## Migration Contents

The migration creates:
- ✅ `doctor_dashboard_preview` table
- ✅ Unique index on `doctorId`
- ✅ Indexes for efficient queries
- ✅ Foreign key constraint to `doctors` table
- ✅ Auto-update trigger for `updatedAt`

## After Migration

Once the migration is applied, run the seed script:

```bash
npx tsx scripts/seedDoctors.ts
```

This will populate dashboard preview data for all doctors.

## Verification

After applying, verify with:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'doctor_dashboard_preview'
);
```

Or use the verification script:

```bash
npx tsx scripts/verify-dashboard-preview-table.ts
```

## Next Steps

1. ✅ Migration file ready in `supabase/migrations/004_add_doctor_dashboard_preview.sql`
2. ⏭️ Apply via Supabase Dashboard SQL Editor
3. ⏭️ Run seed script to populate data

