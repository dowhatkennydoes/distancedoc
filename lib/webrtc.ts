// TODO: WebRTC utilities - re-export from specialized modules
// TODO: Main entry point for WebRTC functionality

// Re-export Xirsys functions
export { getXirsysIceServers } from './webrtc/xirsys'
export type { XirsysIceServer } from './webrtc/xirsys'

// Re-export peer connection functions
export {
  createPeerConnection,
  getUserMedia,
  getDisplayMedia,
  addMediaTracksToPeer,
  removeMediaTracksFromPeer,
  createDataChannel,
  setupIceCandidateHandler,
  setupConnectionStateHandler,
  createOffer,
  createAnswer,
  setRemoteDescription,
} from './webrtc/peer-connection'

// Re-export audio capture functions
export {
  createAudioStreamer,
  sendAudioChunkToSTT,
} from './webrtc/audio-capture'

