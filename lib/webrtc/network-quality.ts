/**
 * Network Quality Monitoring
 * 
 * Monitors WebRTC connection quality and provides network quality indicators
 * Features:
 * - Connection quality metrics (RTT, packet loss, bandwidth)
 * - Network quality scoring (excellent, good, fair, poor)
 * - Adaptive quality recommendations
 */

export type NetworkQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export interface NetworkQualityMetrics {
  quality: NetworkQuality
  rtt?: number // Round-trip time in ms
  packetLoss?: number // Packet loss percentage
  bandwidth?: number // Estimated bandwidth in kbps
  jitter?: number // Jitter in ms
  timestamp: number
}

export interface NetworkQualityMonitor {
  start: () => void
  stop: () => void
  getQuality: () => NetworkQualityMetrics
  onQualityChange: (callback: (metrics: NetworkQualityMetrics) => void) => () => void
}

/**
 * Create network quality monitor for a peer connection
 */
export function createNetworkQualityMonitor(
  peerConnection: RTCPeerConnection,
  intervalMs: number = 2000
): NetworkQualityMonitor {
  let intervalId: NodeJS.Timeout | null = null
  let currentMetrics: NetworkQualityMetrics = {
    quality: 'unknown',
    timestamp: Date.now(),
  }
  const qualityCallbacks: Set<(metrics: NetworkQualityMetrics) => void> = new Set()

  const calculateQuality = async (): Promise<NetworkQualityMetrics> => {
    try {
      // Get connection stats
      const stats = await peerConnection.getStats()
      
      let rtt: number | undefined
      let packetLoss: number | undefined
      let bandwidth: number | undefined
      let jitter: number | undefined

      // Parse stats to extract metrics
      stats.forEach((report) => {
        // RTT from candidate-pair
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          if (report.currentRoundTripTime) {
            rtt = report.currentRoundTripTime * 1000 // Convert to ms
          }
        }

        // Packet loss from inbound-rtp
        if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
          const packetsReceived = report.packetsReceived || 0
          const packetsLost = report.packetsLost || 0
          const totalPackets = packetsReceived + packetsLost
          if (totalPackets > 0) {
            packetLoss = (packetsLost / totalPackets) * 100
          }
          
          // Jitter
          if (report.jitter) {
            jitter = report.jitter * 1000 // Convert to ms
          }
        }

        // Bandwidth estimation (rough)
        if (report.type === 'remote-inbound-rtp' && report.mediaType === 'video') {
          // Estimate bandwidth from bytesReceived
          const bytesReceived = report.bytesReceived || 0
          if (report.timestamp && currentMetrics.timestamp) {
            const timeDiff = (report.timestamp - currentMetrics.timestamp) / 1000 // seconds
            if (timeDiff > 0) {
              bandwidth = (bytesReceived * 8) / timeDiff / 1000 // kbps
            }
          }
        }
      })

      // Calculate quality score
      let quality: NetworkQuality = 'unknown'

      if (rtt !== undefined || packetLoss !== undefined) {
        // Score based on RTT and packet loss
        let score = 100

        // RTT scoring (lower is better)
        if (rtt !== undefined) {
          if (rtt > 300) score -= 40
          else if (rtt > 200) score -= 25
          else if (rtt > 100) score -= 10
        }

        // Packet loss scoring
        if (packetLoss !== undefined) {
          if (packetLoss > 5) score -= 40
          else if (packetLoss > 2) score -= 25
          else if (packetLoss > 1) score -= 10
        }

        // Jitter scoring
        if (jitter !== undefined) {
          if (jitter > 50) score -= 20
          else if (jitter > 30) score -= 10
        }

        // Bandwidth scoring (higher is better)
        if (bandwidth !== undefined) {
          if (bandwidth < 500) score -= 30
          else if (bandwidth < 1000) score -= 15
        }

        // Determine quality level
        if (score >= 80) quality = 'excellent'
        else if (score >= 60) quality = 'good'
        else if (score >= 40) quality = 'fair'
        else quality = 'poor'
      }

      return {
        quality,
        rtt,
        packetLoss,
        bandwidth,
        jitter,
        timestamp: Date.now(),
      }
    } catch (error) {
      console.error('Error calculating network quality:', error)
      return {
        quality: 'unknown',
        timestamp: Date.now(),
      }
    }
  }

  const start = () => {
    if (intervalId) return

    // Initial calculation
    calculateQuality().then((metrics) => {
      currentMetrics = metrics
      qualityCallbacks.forEach((callback) => callback(metrics))
    })

    // Periodic updates
    intervalId = setInterval(async () => {
      const metrics = await calculateQuality()
      
      // Only notify if quality changed
      if (metrics.quality !== currentMetrics.quality) {
        currentMetrics = metrics
        qualityCallbacks.forEach((callback) => callback(metrics))
      } else {
        currentMetrics = metrics
      }
    }, intervalMs)
  }

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
    qualityCallbacks.clear()
  }

  const getQuality = () => currentMetrics

  const onQualityChange = (callback: (metrics: NetworkQualityMetrics) => void) => {
    qualityCallbacks.add(callback)
    
    // Return unsubscribe function
    return () => {
      qualityCallbacks.delete(callback)
    }
  }

  return {
    start,
    stop,
    getQuality,
    onQualityChange,
  }
}

/**
 * Get recommended video constraints based on network quality
 */
export function getRecommendedVideoConstraints(
  quality: NetworkQuality
): MediaTrackConstraints {
  switch (quality) {
    case 'excellent':
      return {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      }
    case 'good':
      return {
        width: { ideal: 960 },
        height: { ideal: 540 },
        frameRate: { ideal: 25 },
      }
    case 'fair':
      return {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 20 },
      }
    case 'poor':
      return {
        width: { ideal: 320 },
        height: { ideal: 240 },
        frameRate: { ideal: 15 },
      }
    default:
      return {
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 20 },
      }
  }
}

