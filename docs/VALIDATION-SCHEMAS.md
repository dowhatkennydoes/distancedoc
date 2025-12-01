# Zod Validation Schemas - Implementation Summary

## Overview

Centralized Zod validation schemas have been implemented for all API routes that perform database writes. This ensures type safety, data validation, and consistent error handling across the DistanceDoc platform.

## Core Module: `/lib/validation/`

### 1. Schemas (`/lib/validation/schemas.ts`)

All validation schemas are centralized in a single file:

#### **createAppointmentSchema**
- Validates appointment creation data
- Fields: `doctorId`, `patientId`, `scheduledAt`, `duration`, `status`, `visitType`, `reason`, `notes`, `meetingUrl`, `meetingId`
- Validations:
  - `scheduledAt`: ISO datetime or Date object
  - `duration`: 1-480 minutes (max 8 hours)
  - `status`: Enum with default 'SCHEDULED'
  - `visitType`: Enum with default 'VIDEO'
  - `reason`: Max 5000 characters
  - `notes`: Max 10000 characters

#### **updateAppointmentSchema**
- Validates appointment update data
- All fields optional
- Same validations as create schema

#### **intakeResponseSchema**
- Validates intake form submission
- Fields: `formId`, `patientId`, `consultationId`, `appointmentId`, `responses`, `chiefComplaint`, `symptoms`, `currentMedications`, `allergies`, `medicalHistory`, `familyHistory`, `socialHistory`
- Validations:
  - `responses`: Array of question-answer pairs (min 1)
  - `responses.value`: String, array, number, or boolean
  - All text fields have max length limits

#### **messageSchema**
- Validates message creation
- Fields: `threadId`, `content`, `attachments`
- Validations:
  - `content`: 1-10000 characters
  - `attachments`: Array of file record IDs (optional)

#### **fileUploadSchema**
- Validates file upload data
- Fields: `patientId`, `fileName`, `fileType`, `fileSize`, `category`, `description`, `consultationId`, `appointmentId`
- Validations:
  - `fileName`: 1-255 characters
  - `fileType`: Must be in allowed list (images, PDFs, documents)
  - `fileSize`: Max 10MB
  - `category`: Max 100 characters
  - `description`: Max 1000 characters

#### **aiSoapInputSchema**
- Validates AI SOAP note generation input
- Fields: `transcript`, `symptoms`, `patientDemographics`, `vitals`, `intakeFormAnswers`
- Validations:
  - `transcript`: 1-50000 characters
  - `symptoms`: Array of strings (max 500 chars each)
  - `patientDemographics.age`: 1-150
  - `vitals.temperature`: 90-110°F
  - `vitals.heartRate`: 1-300 bpm
  - `vitals.oxygenSaturation`: 0-100%

#### **consultationUpdateSchema**
- Validates consultation update data
- Fields: `status`, `startedAt`, `endedAt`, `transcription`, `recordingUrl`
- Validations:
  - `status`: Enum (ACTIVE, COMPLETED, CANCELLED)
  - `startedAt`/`endedAt`: ISO datetime or Date
  - `transcription`: Max 100000 characters
  - `recordingUrl`: Valid URL format

### 2. Validation Utility (`/lib/validation/index.ts`)

#### **validate(schema, payload, requestId?)**
- Main validation function
- Returns validated and typed data
- Throws formatted error with statusCode 400 on validation failure
- Includes detailed error information (path, message, code)

#### **validateOrError(schema, payload, requestId?)**
- Convenience wrapper that returns error response directly
- Returns `{ success: true, data }` or `{ success: false, error: Response }`

#### **formatValidationErrors(error)**
- Helper to format Zod errors for logging

## Updated API Routes

### 1. Appointments (`/app/api/appointments/`)

**Files Updated:**
- `route.ts` - POST endpoint (create appointment)
- `[id]/route.ts` - PUT endpoint (update appointment)

**Changes:**
- Replaced inline Zod schemas with `createAppointmentSchema` and `updateAppointmentSchema`
- Added `validate()` call before database writes
- Improved error handling for validation failures

### 2. Consultations (`/app/api/consultations/[id]/route.ts`)

**Changes:**
- Replaced inline schema with `consultationUpdateSchema`
- Added datetime string-to-Date conversion
- Improved validation error handling

### 3. Intake Forms (`/app/api/forms/[id]/submit/route.ts`)

**Changes:**
- Replaced inline schema with `intakeResponseSchema`
- Added support for optional `consultationId` or `appointmentId`
- Enhanced validation for form responses

### 4. Messages (`/app/api/messages/route.ts`)

**Changes:**
- Created new POST endpoint with `messageSchema` validation
- Validates message content length and attachments
- Ensures user is part of message thread

### 5. File Uploads (`/app/api/files/route.ts`)

**Changes:**
- Added `fileUploadSchema` validation
- Validates file type, size, and metadata
- Improved error messages for invalid file types

### 6. AI SOAP (`/app/api/ai/soap/route.ts`)

**Changes:**
- Replaced inline schema with `aiSoapInputSchema`
- Enhanced validation for vitals and demographics
- Improved type safety for AI input

## Usage Pattern

All API routes now follow this pattern:

```typescript
import { validate } from '@/lib/validation'
import { createAppointmentSchema } from '@/lib/validation/schemas'

export async function POST(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // 1. Authentication & authorization
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)
    
    // 2. Validate request body
    const body = await request.json()
    const validatedData = validate(createAppointmentSchema, body, context.requestId)
    
    // 3. Business logic & database writes
    const result = await prisma.appointment.create({
      data: validatedData,
    })
    
    return apiSuccess(result, 201, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}
```

## Benefits

✅ **Type Safety** - TypeScript types inferred from schemas  
✅ **Data Validation** - All inputs validated before database writes  
✅ **Consistent Errors** - Standardized validation error format  
✅ **Security** - Prevents invalid data from reaching database  
✅ **Maintainability** - Centralized schemas easy to update  
✅ **Documentation** - Schemas serve as API documentation  

## Error Format

Validation errors return:
```json
{
  "error": "Validation failed: scheduledAt: Invalid datetime format, duration: Expected positive number",
  "statusCode": 400,
  "requestId": "req-123",
  "validationErrors": [
    {
      "path": "scheduledAt",
      "message": "Invalid datetime format",
      "code": "invalid_string"
    },
    {
      "path": "duration",
      "message": "Expected positive number",
      "code": "too_small"
    }
  ]
}
```

## Next Steps

1. ✅ All schemas created
2. ✅ Validation utility implemented
3. ✅ All API routes updated
4. ⚠️ Add validation to remaining routes (if any)
5. ⚠️ Add integration tests for validation
6. ⚠️ Document API request/response formats

