# File Upload API - Signed URLs

## Overview

Serverless endpoint for generating signed upload URLs that allow direct client-to-Cloud Storage uploads, improving scalability and reducing server load.

## Endpoint

`POST /api/files/upload-url`

## Features

✅ **Signed URL Generation**
- Creates secure, time-limited upload URLs
- Direct upload to Cloud Storage (bypasses server)
- 1-hour expiration for security

✅ **File Type Validation**
- Images: JPEG, PNG, GIF, WebP
- Documents: PDF, DOC, DOCX
- Size limit: 10MB

✅ **Metadata Storage**
- Saves file metadata in FileRecord table
- Associates with consultations or appointments
- Tracks uploader and timestamps

✅ **Upload Confirmation**
- PUT endpoint to confirm upload completion
- Updates file record with storage URL
- Generates signed download URL

## Request

```typescript
POST /api/files/upload-url
Content-Type: application/json

{
  "fileName": "lab-results.pdf",
  "fileType": "application/pdf",
  "fileSize": 245760,
  "category": "Lab Results", // Optional
  "description": "Blood test results", // Optional
  "consultationId": "consultation-123", // Optional
  "appointmentId": "appointment-456" // Optional
}
```

## Response

```typescript
{
  "uploadUrl": "https://storage.googleapis.com/...",
  "fileId": "file-record-id",
  "filePath": "patients/patient-id/timestamp-filename.pdf",
  "expiresIn": 3600 // seconds
}
```

## Upload Flow

1. **Client requests signed URL**
   ```typescript
   const response = await fetch('/api/files/upload-url', {
     method: 'POST',
     body: JSON.stringify({ fileName, fileType, fileSize }),
   })
   const { uploadUrl, fileId } = await response.json()
   ```

2. **Upload directly to Cloud Storage**
   ```typescript
   await fetch(uploadUrl, {
     method: 'PUT',
     body: file,
     headers: { 'Content-Type': file.type },
   })
   ```

3. **Confirm upload completion**
   ```typescript
   await fetch('/api/files/upload-url', {
     method: 'PUT',
     body: JSON.stringify({ fileId }),
   })
   ```

## File Association

Files can be associated with:
- **Consultation**: Links file to a specific consultation
- **Appointment**: Links file to an appointment
- **Patient**: Automatically associated with patient chart

## Security

- ✅ Authentication required
- ✅ File type validation
- ✅ File size limits (10MB)
- ✅ Signed URLs expire after 1 hour
- ✅ Access control (users can only upload to their own consultations/appointments)
- ✅ File path sanitization

## File Categories

Common categories:
- `Lab Results`
- `Imaging`
- `Consent Form`
- `Insurance Card`
- `ID Document`
- `General`

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error: File type not allowed"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "error": "Unauthorized - No access to this consultation"
}
```

### 404 Not Found
```json
{
  "error": "Consultation not found"
}
```

## Usage Example

```typescript
// Using the FileUploadSigned component
import { FileUploadSigned } from '@/components/FileUploadSigned'

<FileUploadSigned
  consultationId="consultation-123"
  category="Lab Results"
  onUploadComplete={(file) => {
    console.log('Upload complete:', file)
  }}
  onError={(error) => {
    console.error('Upload error:', error)
  }}
/>
```

## Benefits

1. **Scalability**: Files upload directly to Cloud Storage
2. **Performance**: Reduces server load
3. **Security**: Signed URLs with expiration
4. **Cost**: Lower bandwidth costs on server
5. **Reliability**: Direct upload reduces failure points

## File Record Structure

After upload confirmation, FileRecord contains:
- `id`: Unique file record ID
- `patientId`: Associated patient
- `fileName`: Original file name
- `fileType`: MIME type
- `fileSize`: Size in bytes
- `storageUrl`: Signed download URL
- `storagePath`: Path in Cloud Storage
- `category`: File category
- `description`: Optional description
- `uploadedBy`: User ID who uploaded
- `createdAt`: Upload timestamp

