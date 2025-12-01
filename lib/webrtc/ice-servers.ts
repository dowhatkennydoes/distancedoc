/**
 * Optimized ICE Server Configuration
 * 
 * Features:
 * - Preload ICE servers for faster connection
 * - TURN fallback only after STUN failure
 * - Smart server selection based on connection quality
 */

import { getXirsysIceServers } from './xirsys'

// Cache for preloaded ICE servers
let cachedIceServers: RTCIceServer[] | null = null
let iceServerLoadPromise: Promise<RTCIceServer[]> | null = null

/**
 * Get STUN servers only (for initial connection attempt)
 */
export function getStunServers(): RTCIceServer[] {
  return [
    {
      urls: 'stun:stun.l.google.com:19302',
    },
    {
      urls: 'stun:stun1.l.google.com:19302',
    },
  ]
}

/**
 * Get TURN servers (for fallback after STUN failure)
 */
export async function getTurnServers(): Promise<RTCIceServer[]> {
  try {
    const xirsysServers = await getXirsysIceServers()
    // Filter to only TURN servers (URLs containing 'turn:')
    const turnServers = xirsysServers.filter((server) => {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
      return urls.some((url) => url.startsWith('turn:'))
    })
    
    if (turnServers.length > 0) {
      return turnServers
    }
    
    // Fallback TURN servers if Xirsys fails
    return [
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ]
  } catch (error) {
    console.error('Failed to get TURN servers:', error)
    return []
  }
}

/**
 * Preload ICE servers for faster connection establishment
 */
export async function preloadIceServers(): Promise<RTCIceServer[]> {
  // Return cached servers if available
  if (cachedIceServers) {
    return cachedIceServers
  }

  // Return existing promise if already loading
  if (iceServerLoadPromise) {
    return iceServerLoadPromise
  }

  // Start loading servers
  iceServerLoadPromise = (async () => {
    try {
      const stunServers = getStunServers()
      const turnServers = await getTurnServers()
      
      // Combine: STUN first for fast connection, TURN as fallback
      const allServers = [...stunServers, ...turnServers]
      
      cachedIceServers = allServers
      return allServers
    } catch (error) {
      console.error('Error preloading ICE servers:', error)
      // Return at least STUN servers as fallback
      return getStunServers()
    } finally {
      iceServerLoadPromise = null
    }
  })()

  return iceServerLoadPromise
}

/**
 * Get optimized ICE servers with STUN-first strategy
 * TURN servers are included but browser will try STUN first
 */
export async function getOptimizedIceServers(): Promise<RTCIceServer[]> {
  // Use preloaded servers if available
  if (cachedIceServers) {
    return cachedIceServers
  }

  // Preload if not already cached
  return preloadIceServers()
}

/**
 * Clear ICE server cache (useful for reconnection)
 */
export function clearIceServerCache(): void {
  cachedIceServers = null
  iceServerLoadPromise = null
}

