-- Migration: Upgrade Patient Schema for Full Clinical Data
-- This migration updates the Patient model and related models with comprehensive clinical fields

-- ============================================================================
-- 1. UPDATE PATIENT TABLE - Add New Fields
-- ============================================================================

-- Add basic demographics
ALTER TABLE "patients" 
  ADD COLUMN IF NOT EXISTS "firstName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastName" TEXT,
  ADD COLUMN IF NOT EXISTS "sex" TEXT,
  ADD COLUMN IF NOT EXISTS "genderIdentity" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT;

-- Rename phoneNumber to phone if needed
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' AND column_name = 'phoneNumber'
  ) THEN
    ALTER TABLE "patients" RENAME COLUMN "phoneNumber" TO "phone";
  END IF;
END $$;

-- Add address fields
ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "state" TEXT,
  ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

-- Add preferences
ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "preferredPharmacy" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT;

-- Add JSON fields for medical history
ALTER TABLE "patients"
  ADD COLUMN IF NOT EXISTS "currentMedicationsData" JSONB,
  ADD COLUMN IF NOT EXISTS "pastMedicalHistory" JSONB,
  ADD COLUMN IF NOT EXISTS "familyHistory" JSONB;

-- Handle allergies migration from TEXT[] to JSONB
DO $$
BEGIN
  -- If allergies exists as TEXT[], convert to JSONB
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' 
      AND column_name = 'allergies' 
      AND udt_name = '_text'
  ) THEN
    -- Create temporary JSONB column
    ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "allergies_jsonb" JSONB;
    
    -- Migrate data
    UPDATE "patients" 
    SET "allergies_jsonb" = to_jsonb("allergies")
    WHERE "allergies" IS NOT NULL;
    
    -- Drop old column
    ALTER TABLE "patients" DROP COLUMN IF EXISTS "allergies";
    
    -- Rename new column
    ALTER TABLE "patients" RENAME COLUMN "allergies_jsonb" TO "allergies";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'patients' AND column_name = 'allergies'
  ) THEN
    -- Create new JSONB column if it doesn't exist
    ALTER TABLE "patients" ADD COLUMN "allergies" JSONB;
  END IF;
END $$;

-- ============================================================================
-- 2. ADD CLINIC_ID TO RELATED TABLES
-- ============================================================================

ALTER TABLE "consultations"
  ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'default-clinic';

ALTER TABLE "intake_forms"
  ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'default-clinic';

ALTER TABLE "lab_orders"
  ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'default-clinic';

ALTER TABLE "file_records"
  ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'default-clinic';

-- ============================================================================
-- 3. CREATE INDEXES FOR PATIENT TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS "patients_lastName_firstName_idx" 
  ON "patients"("lastName", "firstName");

CREATE INDEX IF NOT EXISTS "patients_email_idx" 
  ON "patients"("email");

CREATE INDEX IF NOT EXISTS "patients_phone_idx" 
  ON "patients"("phone");

CREATE INDEX IF NOT EXISTS "patients_clinicId_lastName_firstName_idx" 
  ON "patients"("clinicId", "lastName", "firstName");

-- ============================================================================
-- 4. CREATE INDEXES FOR CONSULTATIONS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "consultations_clinicId_idx" 
  ON "consultations"("clinicId");

CREATE INDEX IF NOT EXISTS "consultations_clinicId_doctorId_idx" 
  ON "consultations"("clinicId", "doctorId");

CREATE INDEX IF NOT EXISTS "consultations_clinicId_patientId_idx" 
  ON "consultations"("clinicId", "patientId");

-- ============================================================================
-- 5. CREATE INDEXES FOR INTAKE FORMS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "intake_forms_clinicId_idx" 
  ON "intake_forms"("clinicId");

CREATE INDEX IF NOT EXISTS "intake_forms_clinicId_patientId_idx" 
  ON "intake_forms"("clinicId", "patientId");

-- ============================================================================
-- 6. CREATE INDEXES FOR LAB ORDERS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_idx" 
  ON "lab_orders"("clinicId");

CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_patientId_idx" 
  ON "lab_orders"("clinicId", "patientId");

CREATE INDEX IF NOT EXISTS "lab_orders_clinicId_doctorId_idx" 
  ON "lab_orders"("clinicId", "doctorId");

-- ============================================================================
-- 7. CREATE INDEXES FOR FILE RECORDS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "file_records_clinicId_idx" 
  ON "file_records"("clinicId");

CREATE INDEX IF NOT EXISTS "file_records_clinicId_patientId_idx" 
  ON "file_records"("clinicId", "patientId");

-- ============================================================================
-- 8. CREATE ADDITIONAL INDEXES FOR APPOINTMENTS
-- ============================================================================

CREATE INDEX IF NOT EXISTS "appointments_patientId_scheduledAt_idx" 
  ON "appointments"("patientId", "scheduledAt");

-- ============================================================================
-- 9. ADD COLUMN COMMENTS
-- ============================================================================

COMMENT ON COLUMN "patients"."firstName" IS 'Patient first name';
COMMENT ON COLUMN "patients"."lastName" IS 'Patient last name';
COMMENT ON COLUMN "patients"."sex" IS 'Biological sex';
COMMENT ON COLUMN "patients"."genderIdentity" IS 'Gender identity';
COMMENT ON COLUMN "patients"."preferredLanguage" IS 'Preferred language for communication';
COMMENT ON COLUMN "patients"."currentMedicationsData" IS 'Structured JSON data for current medications';
COMMENT ON COLUMN "patients"."pastMedicalHistory" IS 'Structured JSON data for past medical history';
COMMENT ON COLUMN "patients"."familyHistory" IS 'Structured JSON data for family medical history';
COMMENT ON COLUMN "consultations"."clinicId" IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN "intake_forms"."clinicId" IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN "lab_orders"."clinicId" IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN "file_records"."clinicId" IS 'Tenant isolation - clinic identifier';

