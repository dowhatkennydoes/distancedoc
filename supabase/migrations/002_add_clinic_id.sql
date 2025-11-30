-- Add clinic_id to user_roles table for tenant isolation
ALTER TABLE user_roles
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinic_id to doctors table
ALTER TABLE doctors
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinic_id to patients table
ALTER TABLE patients
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinic_id to appointments table
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinic_id to visit_notes table
ALTER TABLE visit_notes
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Add clinic_id to message_threads table
ALTER TABLE message_threads
ADD COLUMN IF NOT EXISTS clinic_id TEXT NOT NULL DEFAULT 'default-clinic';

-- Create indexes for clinic scoping
CREATE INDEX IF NOT EXISTS idx_user_roles_clinic_id ON user_roles(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_id ON doctors(clinic_id);
CREATE INDEX IF NOT EXISTS idx_doctors_clinic_user ON doctors(clinic_id, "userId");
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_user ON patients(clinic_id, "userId");
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_doctor ON appointments(clinic_id, "doctorId");
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_patient ON appointments(clinic_id, "patientId");
CREATE INDEX IF NOT EXISTS idx_visit_notes_clinic_id ON visit_notes(clinic_id);
CREATE INDEX IF NOT EXISTS idx_visit_notes_clinic_doctor ON visit_notes(clinic_id, "doctorId");
CREATE INDEX IF NOT EXISTS idx_visit_notes_clinic_patient ON visit_notes(clinic_id, "patientId");
CREATE INDEX IF NOT EXISTS idx_message_threads_clinic_id ON message_threads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_clinic_doctor ON message_threads(clinic_id, "doctorId");
CREATE INDEX IF NOT EXISTS idx_message_threads_clinic_patient ON message_threads(clinic_id, "patientId");

-- Add comments for documentation
COMMENT ON COLUMN user_roles.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN doctors.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN patients.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN appointments.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN visit_notes.clinic_id IS 'Tenant isolation - clinic identifier';
COMMENT ON COLUMN message_threads.clinic_id IS 'Tenant isolation - clinic identifier';

