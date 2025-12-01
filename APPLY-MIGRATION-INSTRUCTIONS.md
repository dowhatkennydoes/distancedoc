# Apply Doctor Availability Migration

## Quick Steps

### Option 1: Via Supabase Dashboard (Easiest) ✅

1. **Go to Supabase Dashboard**
   - URL: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar

3. **Open the Migration File**
   - File: `prisma/migrations/20251130142452_add_doctor_availability/APPLY-VIA-DASHBOARD.sql`
   - OR copy the SQL from below

4. **Copy & Paste the SQL**
   - Copy the entire contents of the SQL file
   - Paste into the SQL Editor

5. **Run the SQL**
   - Click "Run" button
   - Wait for completion

6. **Verify**
   - You should see success messages
   - Check that no errors occurred

## SQL to Copy

```sql
-- Step 1: Create DayOfWeek Enum (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DayOfWeek') THEN
    CREATE TYPE "DayOfWeek" AS ENUM (
      'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
    );
    RAISE NOTICE 'DayOfWeek enum created';
  ELSE
    RAISE NOTICE 'DayOfWeek enum already exists';
  END IF;
END $$;

-- Step 2: Create doctor_availability table
CREATE TABLE IF NOT EXISTS "doctor_availability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctor_availability_pkey" PRIMARY KEY ("id")
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS "doctor_availability_doctorId_idx" 
  ON "doctor_availability"("doctorId");
CREATE INDEX IF NOT EXISTS "doctor_availability_clinicId_idx" 
  ON "doctor_availability"("clinicId");
CREATE INDEX IF NOT EXISTS "doctor_availability_dayOfWeek_idx" 
  ON "doctor_availability"("dayOfWeek");
CREATE INDEX IF NOT EXISTS "doctor_availability_clinicId_doctorId_idx" 
  ON "doctor_availability"("clinicId", "doctorId");
CREATE INDEX IF NOT EXISTS "doctor_availability_doctorId_dayOfWeek_idx" 
  ON "doctor_availability"("doctorId", "dayOfWeek");

-- Step 4: Add foreign key
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'doctor_availability_doctorId_fkey'
  ) THEN
    ALTER TABLE "doctor_availability" 
    ADD CONSTRAINT "doctor_availability_doctorId_fkey" 
    FOREIGN KEY ("doctorId") REFERENCES "doctors"("id") 
    ON DELETE CASCADE ON UPDATE CASCADE;
    RAISE NOTICE 'Foreign key added';
  END IF;
END $$;

-- Step 5: Add updatedAt trigger
CREATE OR REPLACE FUNCTION update_doctor_availability_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW."updatedAt" = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_doctor_availability_updated_at_trigger ON "doctor_availability";
CREATE TRIGGER update_doctor_availability_updated_at_trigger
    BEFORE UPDATE ON "doctor_availability"
    FOR EACH ROW
    EXECUTE FUNCTION update_doctor_availability_updated_at();
```

## Verification

After applying, run this in SQL Editor to verify:

```sql
-- Check enum
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'DayOfWeek'::regtype 
ORDER BY enumsortorder;

-- Check table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'doctor_availability';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'doctor_availability';
```

## What This Migration Does

1. ✅ Creates `DayOfWeek` enum with 7 days
2. ✅ Creates `doctor_availability` table
3. ✅ Creates 5 indexes for performance
4. ✅ Adds foreign key to `doctors` table
5. ✅ Adds trigger for auto-updating `updatedAt`

## Next Steps After Migration

Once migration is applied:

1. **Run seed script** to create availability blocks:
   ```bash
   npx tsx scripts/seedDoctors.ts
   ```

2. **Or create manually** via SQL (see seed data below)

## Seed Data (Available After Migration)

You can create availability blocks manually:

```sql
-- Get doctor IDs first
SELECT id, "userId" FROM doctors 
WHERE "clinicId" = 'demo-clinic-001';

-- Then insert availability (replace DOCTOR_ID_1, etc. with actual IDs)
INSERT INTO doctor_availability ("id", "doctorId", "clinicId", "dayOfWeek", "startTime", "endTime")
VALUES
  (gen_random_uuid()::text, 'DOCTOR_ID_1', 'demo-clinic-001', 'MONDAY', '09:00', '13:00'),
  (gen_random_uuid()::text, 'DOCTOR_ID_1', 'demo-clinic-001', 'WEDNESDAY', '12:00', '17:00'),
  (gen_random_uuid()::text, 'DOCTOR_ID_2', 'demo-clinic-001', 'TUESDAY', '09:00', '15:00'),
  (gen_random_uuid()::text, 'DOCTOR_ID_2', 'demo-clinic-001', 'THURSDAY', '10:00', '14:00'),
  (gen_random_uuid()::text, 'DOCTOR_ID_3', 'demo-clinic-001', 'MONDAY', '14:00', '18:00'),
  (gen_random_uuid()::text, 'DOCTOR_ID_3', 'demo-clinic-001', 'FRIDAY', '09:00', '13:00');
```

