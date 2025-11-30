// TODO: Xirsys TURN server integration
// TODO: Fetch TURN server credentials from Xirsys REST API
// TODO: Cache credentials to avoid excessive API calls
// TODO: Handle credential expiration
// TODO: Support multiple TURN servers for redundancy

export interface XirsysIceServer {
  urls: string | string[]
  username?: string
  credential?: string
}

export interface XirsysResponse {
  v: {
    iceServers: Array<{
      urls: string | string[]
      username?: string
      credential?: string
    }>
  }
}

// TODO: Get ICE servers from Xirsys REST API
export async function getXirsysIceServers(): Promise<RTCIceServer[]> {
  const username = process.env.XIRSYS_USERNAME
  const secret = process.env.XIRSYS_SECRET
  const domain = process.env.XIRSYS_DOMAIN

  if (!username || !secret || !domain) {
    console.warn('Xirsys credentials not configured, using default STUN servers')
    return [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ]
  }

  try {
    // Xirsys REST API endpoint
    const url = `https://global.xirsys.net/_turn/${domain}`
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(`${username}:${secret}`),
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Xirsys API error: ${response.statusText}`)
    }

    const data: XirsysResponse = await response.json()

    // Convert Xirsys format to RTCIceServer format
    const iceServers: RTCIceServer[] = data.v.iceServers.map((server) => ({
      urls: server.urls,
      username: server.username,
      credential: server.credential,
    }))

    // Add fallback STUN server
    iceServers.push({
      urls: 'stun:stun.l.google.com:19302',
    })

    return iceServers
  } catch (error) {
    console.error('Failed to fetch Xirsys ICE servers:', error)
    // Return fallback STUN servers
    return [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
    ]
  }
}

