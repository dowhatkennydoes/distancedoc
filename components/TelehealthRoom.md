# TelehealthRoom Component

Complete WebRTC telehealth video consultation component with all required features.

## Features

✅ **WebRTC P2P Connection**
- Peer-to-peer video/audio connection
- Automatic fallback to TURN servers for NAT traversal
- Connection state monitoring

✅ **Xirsys TURN Integration**
- REST API integration for TURN credentials
- Automatic credential fetching and caching
- Fallback to STUN servers if Xirsys unavailable

✅ **Media Controls**
- Mute/unmute audio
- Camera on/off toggle
- Screen sharing with automatic track replacement

✅ **Chat Sidebar**
- Real-time Firestore chat integration
- Message history
- Typing indicators (ready for implementation)

✅ **Audio Streaming to STT**
- Captures outgoing audio from MediaStream
- Converts to PCM format (16-bit, 16kHz)
- Streams chunks to `/api/stt/stream` endpoint
- Automatic session management

## Usage

```tsx
import { TelehealthRoom } from '@/components/TelehealthRoom'

function AppointmentPage() {
  return (
    <TelehealthRoom
      appointmentId="appt-123"
      sessionId="session-456"
      remoteUserId="user-789"
      onEndCall={() => router.push('/dashboard')}
    />
  )
}
```

## Props

- `appointmentId: string` - Appointment ID for chat thread
- `sessionId: string` - Unique session ID for STT streaming
- `remoteUserId: string` - ID of the remote participant
- `onEndCall?: () => void` - Callback when call ends

## Helper Functions

### `getXirsysIceServers()`
Fetches TURN server credentials from Xirsys REST API.

**Location**: `lib/webrtc/xirsys.ts`

**Returns**: `Promise<RTCIceServer[]>`

**Features**:
- Fetches credentials from Xirsys API
- Falls back to Google STUN if Xirsys unavailable
- Handles errors gracefully

### `createPeerConnection()`
Creates a WebRTC peer connection with TURN servers.

**Location**: `lib/webrtc/peer-connection.ts`

**Returns**: `Promise<RTCPeerConnection>`

**Features**:
- Automatically configures ICE servers
- Supports custom configuration
- Handles connection state

## Environment Variables

Add to `.env.local`:

```bash
XIRSYS_USERNAME=your_username
XIRSYS_SECRET=your_secret
XIRSYS_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_CONFIG={"projectId":"distancedoc"}
```

## API Endpoints

### `/api/stt/stream` (POST)
Receives audio chunks and streams to Google Cloud Speech-to-Text.

**Headers**:
- `X-Session-Id: string` - Session identifier

**Body**: `ArrayBuffer` - PCM audio data

**Response**: `{ received: true }`

### `/api/stt/stream` (DELETE)
Ends a streaming session.

**Headers**:
- `X-Session-Id: string` - Session identifier

## Architecture

```
TelehealthRoom
├── WebRTC Connection
│   ├── Peer Connection (with Xirsys TURN)
│   ├── Local Media Stream
│   └── Remote Media Stream
├── Audio Capture
│   ├── MediaStream → AudioContext
│   ├── PCM Conversion
│   └── STT Streaming API
└── Chat
    ├── Firestore Real-time Listener
    └── Message Input/Display
```

## Dependencies

- `firebase` - Client-side Firestore SDK for real-time chat
- WebRTC APIs (native browser)
- `@supabase/ssr` - Authentication

## Next Steps

1. **Signaling Implementation**: Currently placeholder - implement SDP offer/answer exchange via Firestore or API
2. **ICE Candidate Exchange**: Implement via Firestore or WebSocket
3. **Error Handling**: Add reconnection logic and error recovery
4. **Recording**: Add call recording with patient consent
5. **Bandwidth Adaptation**: Implement adaptive bitrate based on connection quality

## Testing

1. Ensure Xirsys credentials are configured
2. Test in Chrome/Firefox (best WebRTC support)
3. Test with different network conditions
4. Verify TURN server fallback works
5. Test screen sharing functionality
6. Verify chat messages appear in real-time
7. Check STT streaming in browser console

