# File Access Refactoring - Ownership and Clinic Enforcement

## Overview

File access has been completely refactored to enforce strict ownership and clinic ID matching, ensuring HIPAA compliance and preventing unauthorized access to patient files.

## Changes Made

### 1. FileRecord Schema Updates (`prisma/schema.prisma`)

The `FileRecord` model now includes all required fields for ownership and tenant isolation:

```prisma
model FileRecord {
  id              String  @id @default(cuid())
  patientId       String  // Patient who owns this file (required)
  clinicId        String  // Tenant isolation - clinic identifier (required)
  createdByUserId String  // User ID who created/uploaded the file (required for audit trail)
  fileName        String
  fileType        String
  fileSize        Int
  storageUrl      String
  storagePath     String
  category        String?
  description     String? @db.Text
  encrypted       Boolean @default(false)
  
  // Relationships
  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  
  // Indexes for efficient querying
  @@index([patientId])
  @@index([clinicId])
  @@index([createdByUserId])
  @@index([clinicId, patientId])
  @@index([clinicId, createdByUserId])
}
```

**Key Changes:**
- ✅ `createdByUserId` is now a **required field** (was optional `uploadedBy`)
- ✅ `patientId` and `clinicId` are required
- ✅ Added indexes for efficient tenant-isolated queries
- ✅ Removed legacy `uploadedBy` field (use `createdByUserId` instead)

### 2. File Download Endpoint (`/api/files/[id]/download`)

**Enhanced with:**
- ✅ `requireOwnershipOrDoctor` guard
- ✅ Clinic ID matching validation
- ✅ Complete audit logging

```typescript
// 3. Enforce: FileRecord clinicId must match user's clinicId
enforceTenant(fileRecord.clinicId, user.clinicId, context)

// 4. Enforce: requireOwnershipOrDoctor - user must be the patient themselves or a doctor with access
await ensureOwnershipOrDoctor(user, fileRecord.patient.id, context)
```

### 3. File Get URL Endpoint (`/api/files/[id]/get-url`) - NEW

**Created new endpoint for secure file viewing:**
- ✅ Validates fileRecord matches user's clinic
- ✅ Validates user has rights to view the file (ownership or doctor access)
- ✅ Generates signed URL for viewing (1 hour expiry)
- ✅ Complete audit logging

### 4. File Upload URL Endpoint (`/api/files/upload-url`)

**Refactored with strict validation:**

#### POST - Generate Upload URL

**Requirements:**
1. ✅ User must be a doctor or the patient themselves
2. ✅ Clinic ID must match
3. ✅ Patient ID must be validated

**For Patients:**
- Can only upload files for themselves
- Patient ID in request must match their own patient ID
- Clinic ID automatically validated from patient record

**For Doctors:**
- Must provide patient ID
- Must have access to the patient (`requireDoctorAccessToPatient`)
- Clinic ID must match between doctor and patient
- File is associated with the patient, not the doctor

**Validations:**
- Consultation/appointment IDs (if provided) must belong to the same patient
- All clinic IDs must match
- Complete audit trail with `createdByUserId`

#### PUT - Confirm Upload Completion

**Requirements:**
- ✅ User must be the one who created the file (`createdByUserId` match)
- ✅ FileRecord clinicId must match user's clinicId
- ✅ File must exist in storage

**Enforcement:**
```typescript
// Enforce: User must be the one who created the file
if (fileRecord.createdByUserId !== session.id) {
  return apiError('You can only confirm uploads for files you created', 403)
}
```

### 5. File List Endpoint (`/api/files`)

**Already includes:**
- ✅ Clinic scoping via `withClinicScope`
- ✅ Ownership validation via `ensureOwnershipOrDoctor`
- ✅ Audit logging

## Access Control Rules

### Patient Access to Files

**Can access:**
- ✅ Their own files (patientId matches)
- ✅ Files in their clinic (clinicId matches)

**Cannot access:**
- ❌ Other patients' files (even in same clinic)
- ❌ Files from other clinics

### Doctor Access to Files

**Can access:**
- ✅ Files for patients they have a relationship with
- ✅ Files in their clinic (clinicId matches)
- ✅ Must have established relationship (appointment, consultation, lab order, etc.)

**Cannot access:**
- ❌ Files for patients without relationship
- ❌ Files from other clinics

## Validation Flow

### Upload Flow

```
1. User authenticates → Session validated
2. Role check → Must be doctor or patient
3. Patient ID validation:
   - Patient: Must upload for themselves
   - Doctor: Must have access to patient
4. Clinic ID validation:
   - All resources must belong to same clinic
5. File record created with:
   - patientId (required)
   - clinicId (required)
   - createdByUserId (required)
6. Signed upload URL generated
```

### Download/View Flow

```
1. User authenticates → Session validated
2. Role check → Must be doctor or patient
3. File record fetched
4. Clinic ID validation:
   - FileRecord.clinicId must match user.clinicId
5. Ownership validation:
   - requireOwnershipOrDoctor check
6. Storage file verified
7. Signed URL generated
8. Audit log entry created
```

## Security Features

### 1. Tenant Isolation

All file operations enforce clinic ID matching:

```typescript
enforceTenant(fileRecord.clinicId, user.clinicId, context)
```

- Throws 403 if clinic mismatch
- Logs all violations for audit

### 2. Ownership Validation

Patients can only access their own files:

```typescript
await ensureOwnershipOrDoctor(user, fileRecord.patient.id, context)
```

- Validates patient ID matches
- For doctors, validates relationship exists

### 3. Creator Tracking

Every file tracks who created it:

```typescript
createdByUserId: session.id // Required field
```

- Enables audit trails
- Prevents unauthorized upload confirmations

### 4. Comprehensive Audit Logging

All file operations are logged:
- File upload URL generation
- File upload confirmation
- File download/view
- File list access
- Access denials

## Updated Endpoints

### 1. `/api/files/upload-url` (POST)

**Validates:**
- ✅ User is doctor or patient themselves
- ✅ Clinic ID matches
- ✅ Patient ID is valid and accessible
- ✅ Consultation/appointment (if provided) belongs to patient

**Returns:**
- Signed upload URL
- File record ID
- File path
- Expiry time

### 2. `/api/files/upload-url` (PUT)

**Validates:**
- ✅ User created the file (`createdByUserId` match)
- ✅ Clinic ID matches
- ✅ File exists in storage

**Returns:**
- Updated file record with storage URL

### 3. `/api/files/[id]/download` (GET)

**Validates:**
- ✅ Clinic ID matches
- ✅ `requireOwnershipOrDoctor` access
- ✅ File exists in storage

**Returns:**
- Signed download URL
- File metadata
- Expiry time

### 4. `/api/files/[id]/get-url` (GET) - NEW

**Validates:**
- ✅ FileRecord matches user's clinic
- ✅ User has rights to view the file

**Returns:**
- Signed view URL
- File metadata
- Expiry time

### 5. `/api/files` (GET)

**Validates:**
- ✅ Clinic scoping
- ✅ Ownership validation

**Returns:**
- List of files user has access to

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Forbidden: You can only upload files for yourself",
  "statusCode": 403,
  "requestId": "req-123"
}
```

**Common Errors:**
- `400` - Missing required parameters
- `401` - Unauthorized (invalid session)
- `403` - Forbidden (access denied, clinic mismatch, ownership violation)
- `404` - File not found

## Audit Logging

All file operations generate audit logs:

**Upload URL Generated:**
```typescript
logAudit('FILE_UPLOAD_URL_GENERATED', 'file', fileId, userId, true, {
  fileName,
  fileSize,
  patientId,
  clinicId,
  userRole,
})
```

**File View/Download:**
```typescript
logAccess({
  action: 'GET_FILE_VIEW_URL',
  resourceType: 'file',
  resourceId: fileId,
  metadata: { fileSize, fileType, category },
})
```

## Migration Notes

To update existing FileRecord records:

1. **Add `createdByUserId` field:**
   ```sql
   ALTER TABLE file_records 
   ADD COLUMN created_by_user_id TEXT NOT NULL DEFAULT '';
   
   -- Migrate from uploadedBy if it exists
   UPDATE file_records 
   SET created_by_user_id = uploaded_by 
   WHERE created_by_user_id = '' AND uploaded_by IS NOT NULL;
   
   -- Set default for any remaining nulls (if needed)
   -- Note: You'll need to handle this based on your data
   ```

2. **Remove legacy `uploadedBy` field (after migration):**
   ```sql
   ALTER TABLE file_records 
   DROP COLUMN uploaded_by;
   ```

3. **Add indexes:**
   ```sql
   CREATE INDEX idx_file_records_created_by_user_id 
   ON file_records(created_by_user_id);
   
   CREATE INDEX idx_file_records_clinic_created_by 
   ON file_records(clinic_id, created_by_user_id);
   ```

## Benefits

✅ **Strict Ownership** - Users can only access files they own or have permission for  
✅ **Clinic Isolation** - Complete tenant separation  
✅ **Audit Trail** - Every file operation logged  
✅ **HIPAA Compliance** - Proper access controls and logging  
✅ **Type Safety** - TypeScript ensures required fields are set  
✅ **Maintainable** - Centralized validation logic  

## Testing Checklist

- [ ] Patient can upload file for themselves
- [ ] Patient cannot upload file for another patient
- [ ] Doctor can upload file for patient they have access to
- [ ] Doctor cannot upload file for patient without relationship
- [ ] Clinic ID mismatch blocks access
- [ ] File download requires ownership or doctor access
- [ ] File view URL requires ownership or doctor access
- [ ] Upload confirmation requires creator match
- [ ] All operations generate audit logs

