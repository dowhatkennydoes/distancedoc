# GCP Utility Modules

This directory contains core Google Cloud Platform utility modules for DistanceDoc.

## Modules

### `gcp-sql.ts`
Cloud SQL connector for Postgres database connections.
- Supports Unix socket connections (Cloud Functions/Cloud Run)
- Supports TCP connections (local development)
- Connection pooling
- Transaction support
- Query helpers

### `gcp-storage.ts`
Google Cloud Storage client and signed URL generator.
- Generate signed URLs for uploads/downloads
- Direct file uploads
- File metadata management
- Unique file name generation

### `gcp-vertex.ts`
Vertex AI clients for Gemini 1.5 Flash and Speech-to-Text.
- SOAP note generation (text and structured JSON)
- Streaming SOAP note generation
- Audio transcription
- Streaming transcription for real-time use
- Medical terminology model support

### `gcp-logging.ts`
Cloud Logging helper for structured logging.
- Log levels (DEBUG, INFO, WARN, ERROR)
- Structured logging with metadata
- Request/response logging middleware
- Sensitive data redaction
- Trace ID correlation

### `gcp-firestore.ts`
Firestore client initialization and helper functions.
- Collection references
- CRUD operations
- Paginated queries
- Batch operations
- Transactions
- Real-time listeners

## Environment Variables

Required environment variables (see `.env.example`):

- `GCP_PROJECT_ID` - GCP project ID
- `GCP_REGION` - GCP region (e.g., us-central1)
- `GCP_SQL_INSTANCE` - Cloud SQL instance name
- `GCP_STORAGE_BUCKET` - Cloud Storage bucket name
- `GCP_FIREBASE_CONFIG` - Firebase configuration JSON
- `GCP_SERVICE_ACCOUNT` - Base64 encoded service account JSON (optional)

## Usage Examples

### Cloud SQL
```typescript
import { query, transaction } from '@/lib/gcp/gcp-sql'

const users = await query('SELECT * FROM users WHERE id = $1', [userId])
```

### Cloud Storage
```typescript
import { generateSignedUploadUrl } from '@/lib/gcp/gcp-storage'

const uploadUrl = await generateSignedUploadUrl('documents/file.pdf', 'application/pdf')
```

### Vertex AI
```typescript
import { generateSOAPNote } from '@/lib/gcp/gcp-vertex'

const soapNote = await generateSOAPNote(transcription, patientHistory)
```

### Logging
```typescript
import { logInfo, logError } from '@/lib/gcp/gcp-logging'

await logInfo('User logged in', { userId: '123' })
```

### Firestore
```typescript
import { collections, createDocument } from '@/lib/gcp/gcp-firestore'

await createDocument(collections.messages(), {
  chatId: 'chat123',
  text: 'Hello',
  senderId: 'user123',
})
```

