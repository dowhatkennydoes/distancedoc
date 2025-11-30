# Speech-to-Text Streaming Implementation

## Overview

Stateless and scalable STT streaming endpoint that accepts audio chunks from WebRTC, streams them to Vertex AI Speech-to-Text, and stores transcripts in Firestore.

## Architecture

```
WebRTC Audio → POST /api/stt/stream → Vertex AI STT → Firestore
                                    ↓
                            Real-time Updates
                                    ↓
                            GET /api/stt/stream/sse → Frontend
```

## Endpoints

### POST `/api/stt/stream`

Accepts raw audio chunks and streams them to Vertex AI Speech-to-Text.

**Headers**:
- `X-Session-Id: string` - Unique session identifier
- `X-Consultation-Id: string` - Consultation ID for transcript storage
- `Authorization: Bearer <token>` - Auth token

**Body**: `ArrayBuffer` - Raw PCM audio data (16-bit, 16kHz, LINEAR16)

**Response**:
```json
{
  "success": true,
  "message": "Audio chunk received and processing"
}
```

**Features**:
- Stateless design (no in-memory state)
- Automatic transcript storage in Firestore
- Handles both partial and final transcripts
- Scalable (can handle multiple concurrent sessions)

### GET `/api/stt/stream?consultationId={id}`

Retrieves current transcription for a consultation.

**Query Parameters**:
- `consultationId: string` - Consultation ID

**Response**:
```json
{
  "consultationId": "consultation-123",
  "transcription": [
    {
      "text": "Hello, how are you?",
      "isFinal": true,
      "timestamp": "2024-01-01T12:00:00Z",
      "sessionId": "session-456"
    }
  ],
  "updatedAt": "2024-01-01T12:00:00Z"
}
```

### GET `/api/stt/stream/sse?consultationId={id}`

Server-Sent Events stream for real-time transcript updates.

**Query Parameters**:
- `consultationId: string` - Consultation ID

**Response**: Server-Sent Events stream

**Event Format**:
```
data: {"type":"connected"}

data: {"type":"transcript","transcription":[...],"updatedAt":"..."}

data: {"type":"error","message":"..."}
```

### DELETE `/api/stt/stream`

Ends a streaming session.

**Headers**:
- `X-Session-Id: string` - Session identifier

**Response**:
```json
{
  "success": true,
  "message": "Streaming session ended"
}
```

## Firestore Structure

### `consultations/{consultationId}`

```typescript
{
  transcription: [
    {
      text: string
      isFinal: boolean
      timestamp: Timestamp
      sessionId: string
    }
  ],
  transcriptionUpdatedAt: Timestamp
}
```

## Usage Example

### Frontend - Sending Audio Chunks

```typescript
const audioStreamer = createAudioStreamer(stream, async (chunk) => {
  await fetch('/api/stt/stream', {
    method: 'POST',
    headers: {
      'X-Session-Id': sessionId,
      'X-Consultation-Id': consultationId,
      'Authorization': `Bearer ${token}`,
    },
    body: chunk,
  })
})
```

### Frontend - Receiving Real-time Updates

```typescript
const eventSource = new EventSource(
  `/api/stt/stream/sse?consultationId=${consultationId}`
)

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data)
  if (data.type === 'transcript') {
    // Update UI with new transcription
    updateTranscript(data.transcription)
  }
}
```

## Stateless Design

The implementation is stateless:
- No in-memory session storage
- Session state tracked via Firestore
- Each request is independent
- Scales horizontally

## Scalability Features

1. **Stateless**: No server-side session state
2. **Async Processing**: Returns immediately, processes in background
3. **Firestore**: Distributed storage for transcripts
4. **SSE**: Efficient real-time updates without polling
5. **Error Handling**: Graceful degradation on errors

## Error Handling

- Invalid session/consultation IDs return 400
- Authentication failures return 401
- Firestore errors are logged but don't block audio processing
- STT errors are logged and handled gracefully

## Performance Considerations

- Audio chunks should be sent in regular intervals (e.g., every 100-200ms)
- Chunk size: ~4KB-8KB for optimal performance
- Firestore writes are batched automatically
- Partial transcripts are replaced (not accumulated) to save storage

## Security

- ✅ Authentication required for all endpoints
- ✅ User can only access their own consultations
- ✅ Session IDs are validated
- ⚠️ Add rate limiting for production
- ⚠️ Validate consultation ownership

## Testing

1. Test with real audio chunks from WebRTC
2. Verify transcripts appear in Firestore
3. Test SSE stream for real-time updates
4. Test with multiple concurrent sessions
5. Verify error handling

## Troubleshooting

### Transcripts not appearing
- Check Firestore security rules
- Verify consultation ID is correct
- Check server logs for errors
- Verify authentication token

### SSE stream not working
- Check browser supports EventSource
- Verify consultation ID is correct
- Check network tab for connection issues
- Verify Firestore listener is working

### Audio not being processed
- Verify audio format (LINEAR16, 16kHz)
- Check chunk size (not too large/small)
- Verify Vertex AI credentials
- Check server logs for STT errors

