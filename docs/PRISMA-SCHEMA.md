# Prisma Schema Documentation

## Overview

The DistanceDoc Prisma schema defines a comprehensive database structure for a HIPAA-compliant telehealth platform with 12 core models and extensive relationships.

## Models

### 1. Doctor
- **Purpose**: Healthcare provider information
- **Key Fields**: `licenseNumber`, `npiNumber`, `specialization`, `credentials`
- **Relationships**: Appointments, Consultations, VisitNotes, LabOrders, Messages

### 2. Patient
- **Purpose**: Patient medical information and demographics
- **Key Fields**: `dateOfBirth`, `insuranceProvider`, `medicalHistory`, `allergies`
- **Relationships**: Appointments, Consultations, VisitNotes, IntakeForms, Medications, LabOrders, FileRecords, Messages, Payments

### 3. Appointment
- **Purpose**: Scheduled visits between doctors and patients
- **Key Fields**: `scheduledAt`, `status`, `visitType`, `meetingUrl`
- **Relationships**: Doctor, Patient, Consultation, VisitNote
- **Enums**: `AppointmentStatus`, `VisitType`

### 4. Consultation
- **Purpose**: Active visit session tracking
- **Key Fields**: `transcription`, `recordingUrl`, `startedAt`, `endedAt`
- **Relationships**: Appointment, Doctor, Patient, VisitNote
- **Enums**: `ConsultationStatus`

### 5. VisitNote
- **Purpose**: SOAP note clinical documentation
- **Key Fields**: `subjective`, `objective`, `assessment`, `plan`, `diagnosis`, `procedures`
- **AI Support**: `aiGenerated`, `aiModel` fields for AI-generated notes
- **Relationships**: Appointment, Consultation, Doctor, Patient

### 6. IntakeForm
- **Purpose**: Pre-visit patient intake forms
- **Key Fields**: `formData` (JSON), `chiefComplaint`, `symptoms`, `medicalHistory`
- **Relationships**: Patient
- **Enums**: `IntakeFormType`, `IntakeFormStatus`

### 7. Medication
- **Purpose**: Patient medication tracking
- **Key Fields**: `name`, `dosage`, `frequency`, `route`, `startDate`, `endDate`
- **Relationships**: Patient
- **Enums**: `MedicationStatus`

### 8. LabOrder
- **Purpose**: Laboratory test orders and results
- **Key Fields**: `orderNumber`, `tests`, `results` (JSON), `resultsUrl`
- **Relationships**: Patient, Doctor
- **Enums**: `LabOrderStatus`

### 9. FileRecord
- **Purpose**: Medical document and file storage tracking
- **Key Fields**: `storageUrl`, `storagePath`, `category`, `encrypted`
- **Relationships**: Patient

### 10. MessageThread
- **Purpose**: Communication threads between doctors and patients
- **Key Fields**: `subject`, `lastMessageAt`, `unreadByDoctor`, `unreadByPatient`
- **Relationships**: Doctor, Patient, Messages

### 11. Message
- **Purpose**: Individual messages within threads
- **Key Fields**: `content`, `senderId`, `senderRole`, `attachments`
- **Relationships**: MessageThread

### 12. Payment
- **Purpose**: Payment transaction tracking
- **Key Fields**: `stripePaymentId`, `amount`, `currency`, `status`, `receiptUrl`
- **Relationships**: Patient
- **Enums**: `PaymentStatus`

### 13. Notification
- **Purpose**: System notifications for users
- **Key Fields**: `type`, `title`, `message`, `data` (JSON), `status`
- **Enums**: `NotificationType`, `NotificationStatus`, `UserRole`

## Enums

### UserRole
- `DOCTOR`, `PATIENT`, `ADMIN`, `NURSE`, `STAFF`

### AppointmentStatus
- `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `RESCHEDULED`

### VisitType
- `VIDEO`, `PHONE`, `IN_PERSON`, `CHAT`

### ConsultationStatus
- `ACTIVE`, `COMPLETED`, `CANCELLED`

### IntakeFormType
- `INITIAL`, `FOLLOW_UP`, `PRE_VISIT`, `POST_VISIT`, `ANNUAL`

### IntakeFormStatus
- `DRAFT`, `SUBMITTED`, `REVIEWED`, `ARCHIVED`

### MedicationStatus
- `ACTIVE`, `DISCONTINUED`, `COMPLETED`, `ON_HOLD`

### LabOrderStatus
- `PENDING`, `ORDERED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `RESULTS_READY`

### PaymentStatus
- `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`, `CANCELLED`

### NotificationType
- `APPOINTMENT_REMINDER`, `APPOINTMENT_CONFIRMED`, `APPOINTMENT_CANCELLED`, `MESSAGE_RECEIVED`, `LAB_RESULTS_READY`, `PAYMENT_RECEIVED`, `SYSTEM_ALERT`

### NotificationStatus
- `PENDING`, `SENT`, `DELIVERED`, `READ`, `FAILED`

## Indexes

All models include strategic indexes for performance:

- **Foreign Key Indexes**: All `doctorId`, `patientId`, `appointmentId` fields are indexed
- **Query Optimization**: Status fields, dates, and frequently queried fields are indexed
- **Composite Indexes**: Common query patterns like `[doctorId, scheduledAt]` for appointments

## HIPAA Compliance

### Row Level Security (RLS) Examples

Each model includes commented RLS policy examples in the schema. Key principles:

1. **Patient Data Isolation**: Patients can only see their own data
2. **Doctor Access**: Doctors can only access data for their patients
3. **Admin Override**: Admins have broader access for system management
4. **Audit Trail**: All models include `createdAt` and `updatedAt` timestamps

### Example RLS Policies

```sql
-- Patient data access
CREATE POLICY patient_isolation ON patients
  FOR ALL USING (
    auth.uid() = "userId" OR 
    EXISTS (
      SELECT 1 FROM appointments 
      WHERE patient_id = patients.id 
      AND doctor_id IN (
        SELECT id FROM doctors WHERE user_id = auth.uid()
      )
    )
  );

-- Appointment access
CREATE POLICY appointment_access ON appointments
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM doctors WHERE id = doctor_id) OR
    auth.uid() IN (SELECT user_id FROM patients WHERE id = patient_id)
  );
```

## Relationships

### One-to-Many
- Doctor → Appointments, Consultations, VisitNotes, LabOrders
- Patient → Appointments, Consultations, VisitNotes, IntakeForms, Medications, LabOrders, FileRecords, Payments
- MessageThread → Messages

### One-to-One
- Appointment → Consultation (optional)
- Appointment → VisitNote (optional)
- Consultation → VisitNote (optional)

### Cascade Deletes
- All relationships use `onDelete: Cascade` to maintain referential integrity
- Exception: Consultation → VisitNote uses `onDelete: SetNull` to preserve notes if consultation is deleted

## Usage

### Generate Prisma Client
```bash
npm run db:generate
```

### Apply Migrations
```bash
npm run db:migrate
```

### Push Schema (Development)
```bash
npm run db:push
```

### Open Prisma Studio
```bash
npm run db:studio
```

## Next Steps

1. Set up RLS policies in PostgreSQL
2. Configure connection pooling for Cloud SQL
3. Set up database backups
4. Implement audit logging
5. Add data retention policies for HIPAA compliance

