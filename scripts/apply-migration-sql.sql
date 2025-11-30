-- Tenant Isolation Migration
-- Run this SQL in your Supabase SQL Editor
-- This adds clinicId columns and indexes for tenant isolation

-- Add clinicId to user_roles table for tenant isolation
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinicId to doctors table
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinicId to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinicId to appointments table
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinicId to visit_notes table
ALTER TABLE visit_notes
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinicId to message_threads table
ALTER TABLE message_threads
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Create indexes for clinic scoping
CREATE INDEX IF NOT EXISTS idx_user_roles_clinic_id ON user_roles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_user ON doctors(clinic_id, user_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_user ON patients(clinic_id, user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor ON appointments(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient ON appointments(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_visit_notes_clinic_id ON visit_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_visit_notes_clinic_doctor ON visit_notes(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_visit_notes_clinic_patient ON visit_notes(clinic_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_clinic_id ON message_threads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_clinic_doctor ON message_threads(clinic_id, doctor_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_clinic_patient ON message_threads(clinic_id, patient_id);

-- Add comments for documentation
COMMENT ON COLUMN user_roles.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN doctors.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN patients.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN appointments.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN visit_notes.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN message_threads.clinic_id IS 'Tenant isolation - clinic identifier';

-- Verify migration
SELECT 
  'user_roles' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'clinic_id') as has_clinic_id
UNION ALL
SELECT 
  'doctors' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'clinic_id') as has_clinic_id
UNION ALL
SELECT 
  'patients' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'clinic_id') as has_clinic_id
UNION ALL
SELECT 
  'appointments' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'clinic_id') as has_clinic_id
UNION ALL
SELECT 
  'visit_notes' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'visit_notes' AND column_name = 'clinic_id') as has_clinic_id
UNION ALL
SELECT 
  'message_threads' as table_name,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'message_threads' AND column_name = 'clinic_id') as has_clinic_id;

