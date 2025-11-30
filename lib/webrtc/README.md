# WebRTC Utilities

Complete WebRTC implementation for telehealth video calls with signaling, TURN servers, and audio streaming.

## Modules

### `xirsys.ts` - TURN Server Integration
- `getXirsysIceServers()` - Fetches TURN credentials from Xirsys REST API
- Automatic fallback to STUN servers
- Error handling and caching

### `peer-connection.ts` - Peer Connection Management
- `createPeerConnection()` - Creates RTCPeerConnection with TURN servers
- `getUserMedia()` - Gets camera/microphone stream
- `getDisplayMedia()` - Gets screen share stream
- `addMediaTracksToPeer()` - Adds tracks to peer connection
- `removeMediaTracksFromPeer()` - Removes tracks from peer connection
- `createOffer()` - Creates SDP offer
- `createAnswer()` - Creates SDP answer
- `setRemoteDescription()` - Sets remote SDP description
- `setupIceCandidateHandler()` - Handles ICE candidates
- `setupConnectionStateHandler()` - Monitors connection state

### `audio-capture.ts` - Audio Streaming
- `createAudioStreamer()` - Captures audio and converts to PCM
- `sendAudioChunkToSTT()` - Sends audio chunks to Speech-to-Text API
- Automatic audio processing and encoding

### `signaling.ts` - WebRTC Signaling
- `createSignalingChannel()` - Creates Firestore-based signaling channel
- Exchanges SDP offers/answers
- Exchanges ICE candidates
- Real-time updates via Firestore listeners
- Automatic cleanup

## Usage

### Basic Setup

```typescript
import { createPeerConnection, getUserMedia } from '@/lib/webrtc/peer-connection'
import { createSignalingChannel } from '@/lib/webrtc/signaling'

// Get user media
const stream = await getUserMedia({ video: true, audio: true })

// Create peer connection
const peerConnection = await createPeerConnection()

// Create signaling channel
const signaling = createSignalingChannel(sessionId, localUserId, remoteUserId)

// Handle ICE candidates
peerConnection.onicecandidate = async (event) => {
  if (event.candidate) {
    await signaling.sendIceCandidate(event.candidate.toJSON())
  }
}

// Listen for remote ICE candidates
signaling.onIceCandidate(async (candidate) => {
  await peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
})

// Create and send offer (if initiator)
if (isInitiator) {
  const offer = await createOffer(peerConnection)
  await signaling.sendOffer(offer)
  
  // Listen for answer
  signaling.onRemoteAnswer(async (answer) => {
    await setRemoteDescription(peerConnection, answer)
  })
} else {
  // Wait for offer, then answer
  signaling.onRemoteOffer(async (offer) => {
    await setRemoteDescription(peerConnection, offer)
    const answer = await createAnswer(peerConnection)
    await signaling.sendAnswer(answer)
  })
}
```

## Signaling Flow

1. **Initiator** (user with smaller ID):
   - Creates offer
   - Sends offer via Firestore
   - Waits for answer
   - Sets remote description when answer received

2. **Receiver**:
   - Waits for offer
   - Sets remote description when offer received
   - Creates answer
   - Sends answer via Firestore

3. **Both parties**:
   - Exchange ICE candidates via Firestore
   - Add remote ICE candidates to peer connection
   - Connection established when ICE completes

## Firestore Structure

Signaling documents are stored in `webrtc_signaling` collection:

```
webrtc_signaling/
  session-{sessionId}-{userId}/
    type: 'offer' | 'answer' | 'ice-candidate'
    sdp?: RTCSessionDescriptionInit
    candidate?: RTCIceCandidateInit
    from: string
    to: string
    timestamp: Timestamp
```

## Environment Variables

```bash
XIRSYS_USERNAME=your_username
XIRSYS_SECRET=your_secret
XIRSYS_DOMAIN=your_domain
NEXT_PUBLIC_FIREBASE_CONFIG={"projectId":"distancedoc"}
```

## Error Handling

- TURN server failures fall back to STUN
- Signaling errors are logged
- Connection state changes are monitored
- Automatic cleanup on disconnect

## Testing

1. Test in Chrome/Firefox (best WebRTC support)
2. Test with different network conditions
3. Verify TURN server fallback
4. Test signaling with two browser tabs
5. Verify ICE candidate exchange
6. Test connection establishment

