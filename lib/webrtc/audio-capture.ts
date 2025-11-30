// TODO: Audio capture and streaming utilities
// TODO: Capture audio from MediaStream
// TODO: Send audio chunks to Speech-to-Text API
// TODO: Handle audio processing and encoding
// TODO: Support different audio formats
// TODO: Handle errors and reconnection

export interface AudioStreamConfig {
  sampleRate?: number
  channels?: number
  bitsPerSample?: number
}

// TODO: Capture audio from MediaStream and send to STT API
export function createAudioStreamer(
  stream: MediaStream,
  onChunk?: (chunk: ArrayBuffer) => void
): {
  start: () => void
  stop: () => void
  isStreaming: () => boolean
} {
  let audioContext: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let processorNode: ScriptProcessorNode | null = null
  let isStreaming = false

  const start = async () => {
    if (isStreaming) return

    try {
      // Create AudioContext
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // Speech-to-Text typically uses 16kHz
      })

      // Get audio track
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks in stream')
      }

      // Create source node
      sourceNode = audioContext.createMediaStreamSource(stream)

      // Create processor node for audio chunks
      processorNode = audioContext.createScriptProcessor(4096, 1, 1)

      processorNode.onaudioprocess = (event) => {
        if (!isStreaming) return

        const inputBuffer = event.inputBuffer
        const inputData = inputBuffer.getChannelData(0)

        // Convert Float32Array to Int16Array (PCM format)
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          // Clamp and convert to 16-bit integer
          const s = Math.max(-1, Math.min(1, inputData[i]))
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }

        // Send chunk to callback
        if (onChunk) {
          onChunk(int16Data.buffer)
        }
      }

      // Connect nodes
      sourceNode.connect(processorNode)
      processorNode.connect(audioContext.destination)

      isStreaming = true
    } catch (error) {
      console.error('Error starting audio stream:', error)
      throw error
    }
  }

  const stop = () => {
    if (!isStreaming) return

    isStreaming = false

    if (processorNode) {
      processorNode.disconnect()
      processorNode = null
    }

    if (sourceNode) {
      sourceNode.disconnect()
      sourceNode = null
    }

    if (audioContext) {
      audioContext.close()
      audioContext = null
    }
  }

  return {
    start,
    stop,
    isStreaming: () => isStreaming,
  }
}

// TODO: Send audio chunk to STT streaming API
export async function sendAudioChunkToSTT(
  chunk: ArrayBuffer,
  sessionId: string
): Promise<void> {
  try {
    await fetch('/api/stt/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Session-Id': sessionId,
      },
      body: chunk,
    })
  } catch (error) {
    console.error('Error sending audio chunk to STT:', error)
    // Don't throw - allow streaming to continue
  }
}

