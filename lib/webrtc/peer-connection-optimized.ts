/**
 * Optimized Peer Connection Helpers
 * 
 * Features:
 * - Preloaded ICE servers
 * - TURN fallback only after STUN failure
 * - Adaptive video quality based on network conditions
 * - Network quality monitoring
 */

import { getOptimizedIceServers, preloadIceServers } from './ice-servers'
import { createNetworkQualityMonitor, getRecommendedVideoConstraints, type NetworkQuality } from './network-quality'

export interface OptimizedPeerConnectionConfig {
  iceServers?: RTCIceServer[]
  iceTransportPolicy?: RTCIceTransportPolicy
  bundlePolicy?: RTCBundlePolicy
  rtcpMuxPolicy?: RTCRtcpMuxPolicy
  enableNetworkMonitoring?: boolean
}

export interface OptimizedPeerConnection {
  peerConnection: RTCPeerConnection
  networkMonitor?: ReturnType<typeof createNetworkQualityMonitor>
  updateVideoQuality: (quality: NetworkQuality) => Promise<void>
  cleanup: () => void
}

/**
 * Create optimized peer connection with preloaded ICE servers
 */
export async function createOptimizedPeerConnection(
  config: OptimizedPeerConnectionConfig = {}
): Promise<OptimizedPeerConnection> {
  // Preload ICE servers if not already cached
  await preloadIceServers()

  // Get optimized ICE servers (STUN first, TURN as fallback)
  const iceServers = config.iceServers || await getOptimizedIceServers()

  // Create peer connection with optimized configuration
  const peerConnection = new RTCPeerConnection({
    iceServers,
    iceTransportPolicy: config.iceTransportPolicy || 'all', // Try all, STUN first naturally
    bundlePolicy: config.bundlePolicy || 'max-bundle',
    rtcpMuxPolicy: config.rtcpMuxPolicy || 'require',
  })

  // Create network quality monitor if enabled
  let networkMonitor: ReturnType<typeof createNetworkQualityMonitor> | undefined
  
  if (config.enableNetworkMonitoring !== false) {
    networkMonitor = createNetworkQualityMonitor(peerConnection)
    networkMonitor.start()
  }

  /**
   * Update video quality based on network conditions
   */
  const updateVideoQuality = async (quality: NetworkQuality) => {
    const senders = peerConnection.getSenders()
    const videoSender = senders.find(
      (sender) => sender.track && sender.track.kind === 'video'
    )

    if (!videoSender || !videoSender.track) {
      return
    }

    const constraints = getRecommendedVideoConstraints(quality)

    try {
      await videoSender.track.applyConstraints(constraints)
    } catch (error) {
      console.error('Error updating video constraints:', error)
      
      // If constraints fail, try renegotiation with new constraints
      // This is a fallback if applyConstraints doesn't work
      if (videoSender.track instanceof MediaStreamTrack) {
        // Request new track with updated constraints
        const stream = videoSender.track.getSettings()
        // Note: Full renegotiation would require replacing the track
        // For now, we log the error and continue
      }
    }
  }

  /**
   * Cleanup peer connection and monitoring
   */
  const cleanup = () => {
    if (networkMonitor) {
      networkMonitor.stop()
    }
    peerConnection.close()
  }

  return {
    peerConnection,
    networkMonitor,
    updateVideoQuality,
    cleanup,
  }
}

/**
 * Handle ICE connection failure and fallback to TURN
 */
export async function handleIceConnectionFailure(
  peerConnection: RTCPeerConnection,
  onFallback: () => Promise<void>
): Promise<void> {
  let hasFailed = false

  const handleConnectionStateChange = async () => {
    const state = peerConnection.connectionState
    const iceState = peerConnection.iceConnectionState

    // Detect connection failure
    if ((state === 'failed' || iceState === 'failed') && !hasFailed) {
      hasFailed = true
      console.warn('WebRTC connection failed, attempting TURN fallback...')
      
      // Trigger fallback (reconnect with TURN priority)
      await onFallback()
    }
  }

  peerConnection.onconnectionstatechange = handleConnectionStateChange
  peerConnection.oniceconnectionstatechange = handleConnectionStateChange
}

