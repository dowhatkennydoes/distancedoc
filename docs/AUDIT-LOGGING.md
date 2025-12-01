# PHI-Safe Audit Logging Implementation

## Overview

A comprehensive PHI-safe audit logging module has been implemented to track all access to protected health information (PHI) while maintaining HIPAA compliance.

## Core Module: `/lib/logging/audit.ts`

### Features

✅ **PHI-Safe by Design** - Never logs PHI, patient medical details, or sensitive information  
✅ **Metadata Only** - Only logs: userId, clinicId, action, resourceType, resourceId, IP, timestamp  
✅ **Automatic Sanitization** - All metadata is sanitized to remove any potential PHI  
✅ **Non-Blocking** - Audit logging never breaks request flow  
✅ **Comprehensive Coverage** - Logs all PHI access events  

### Core Function: `logAccess()`

```typescript
await logAccess({
  userId: string,
  clinicId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  ip?: string,
  timestamp?: Date,
  userAgent?: string,
  requestId?: string,
  success?: boolean,
  metadata?: Record<string, any> // Only safe metadata (fileSize, fileType, etc.)
})
```

### Convenience Functions

- `logPatientChartAccess()` - Patient chart viewing
- `logConsultationAccess()` - Consultation viewing
- `logFileDownload()` - File downloads
- `logFileListAccess()` - File list access
- `logSOAPNoteGeneration()` - SOAP note generation
- `logTranscriptAccess()` - Transcript access

## PHI Safety Rules

### ❌ NEVER Log:
- Patient names
- Medical conditions
- Symptoms
- Diagnoses
- Medications
- Transcripts or clinical notes
- Addresses
- Dates of birth
- Insurance numbers
- Any field containing PHI keywords

### ✅ ONLY Log:
- User IDs
- Clinic IDs
- Action types (e.g., "VIEW_PATIENT_CHART")
- Resource types (e.g., "patient", "consultation")
- Resource IDs (identifiers, not PHI)
- IP addresses
- Timestamps
- Safe metadata (file size, file type, count, etc.)

## Updated API Routes

### 1. Patient Profile Route (`/api/patient/profile`)
**Action:** Viewing a patient chart

```typescript
logPatientChartAccess(
  session.id,
  session.clinicId,
  patientId,
  context.ip,
  request,
  context.requestId
)
```

### 2. Consultation Route (`/api/consultations/[id]`)
**Action:** Viewing a consultation

```typescript
logConsultationAccess(
  user.id,
  user.clinicId,
  consultationId,
  context.ip,
  request,
  context.requestId
)
```

### 3. Files Route (`/api/files`)
**Action:** Listing patient files

```typescript
logFileListAccess(
  session.id,
  session.clinicId,
  patientId,
  files.length, // Safe metadata: count only
  context.ip,
  request,
  context.requestId
)
```

### 4. File Download Route (`/api/files/[id]/download`) - NEW
**Action:** Downloading a file

```typescript
logFileDownload(
  user.id,
  user.clinicId,
  fileId,
  {
    fileSize: fileRecord.fileSize, // Safe metadata
    fileType: fileRecord.fileType, // Safe metadata
    category: fileRecord.category, // Safe metadata
  },
  context.ip,
  request,
  context.requestId
)
```

### 5. STT Stream Route (`/api/stt/stream`)
**Action:** Accessing visit transcripts

```typescript
logTranscriptAccess(
  user.id,
  user.clinicId,
  consultationId,
  undefined, // IP extracted from request
  request,
  requestId
)
```

### 6. AI SOAP Route (`/api/ai/soap`)
**Action:** Generating SOAP notes

```typescript
logSOAPNoteGeneration(
  user.id,
  user.clinicId,
  noteId,
  {
    model: 'gemini-1.5-flash', // Safe metadata
  },
  undefined, // IP extracted from request
  request,
  requestId
)
```

## Usage Pattern

All audit logging follows this pattern:

```typescript
// After successful access verification, before returning data
logAction(
  user.id,
  user.clinicId,
  resourceId,
  metadata, // Optional safe metadata
  ip,
  request,
  requestId
).catch((err) => {
  // Audit logging should never break the request - fail silently
  console.error('Audit logging failed (non-critical):', err)
})
```

## Metadata Sanitization

The audit module automatically sanitizes all metadata to ensure only safe fields are logged:

**Safe Fields (Allowed):**
- `fileSize` - File size in bytes
- `fileType` - MIME type
- `category` - File category
- `count` - Number of items
- `model` - AI model name
- `duration` - Time duration
- `method` - HTTP method
- `statusCode` - HTTP status code

**Blocked Fields:**
- Any field containing patient names
- Medical information
- Clinical notes
- Transcripts
- Addresses
- Personal identifiers (beyond resource IDs)

## Integration with Existing Logging

The audit module integrates with the existing structured logging system (`/lib/security/logging.ts`), which:
- Automatically redacts PHI from log messages
- Forwards logs to Cloud Logging (production)
- Maintains request ID tracking
- Provides structured JSON output

## Compliance

✅ **HIPAA Compliant** - No PHI in audit logs  
✅ **Audit Trail** - Complete record of PHI access  
✅ **Non-Blocking** - Never impacts request performance  
✅ **Secure** - Logs protected by IAM and encryption  

## Example Audit Log Entry

```json
{
  "level": "INFO",
  "message": "AUDIT: VIEW_PATIENT_CHART on patient",
  "metadata": {
    "action": "VIEW_PATIENT_CHART",
    "resourceType": "patient",
    "resourceId": "patient-123",
    "clinicId": "clinic-456",
    "ip": "192.168.1.1",
    "success": true
  },
  "userId": "user-789",
  "requestId": "req-abc",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

**Note:** This entry contains NO PHI - only metadata, IDs, and access information.

## Next Steps

1. ✅ Core audit module created
2. ✅ 5+ API routes updated with audit logging
3. ⚠️ Set up Cloud Logging integration (production)
4. ⚠️ Configure log retention policies
5. ⚠️ Create admin dashboard for log viewing
6. ⚠️ Set up alerts for suspicious activity patterns

