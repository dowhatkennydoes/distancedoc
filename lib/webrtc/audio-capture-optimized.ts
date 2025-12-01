/**
 * Optimized Audio Capture with Web Worker
 * 
 * Features:
 * - Audio processing in Web Worker (no UI blocking)
 * - Optimized chunk sizes (200-300ms)
 * - Efficient PCM conversion
 */

export interface OptimizedAudioStreamer {
  start: () => Promise<void>
  stop: () => void
  isStreaming: () => boolean
  setChunkDuration: (ms: number) => void
}

export interface OptimizedAudioStreamerConfig {
  sampleRate?: number
  chunkDurationMs?: number // 200-300ms recommended
  onChunk?: (chunk: ArrayBuffer, metadata: { timestamp: number; durationMs: number }) => void
}

/**
 * Create optimized audio streamer using Web Worker
 */
export function createOptimizedAudioStreamer(
  stream: MediaStream,
  config: OptimizedAudioStreamerConfig = {}
): OptimizedAudioStreamer {
  const {
    sampleRate = 16000,
    chunkDurationMs = 250, // Default 250ms (middle of 200-300ms range)
    onChunk,
  } = config

  let audioContext: AudioContext | null = null
  let sourceNode: MediaStreamAudioSourceNode | null = null
  let processorNode: ScriptProcessorNode | null = null
  let worker: Worker | null = null
  let isStreaming = false

  const start = async () => {
    if (isStreaming) return

    try {
      // Create AudioContext
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate,
      })

      // Get audio track
      const audioTracks = stream.getAudioTracks()
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks in stream')
      }

      // Create source node
      sourceNode = audioContext.createMediaStreamSource(stream)

      // Create processor node for audio chunks
      // Use buffer size that matches our chunk duration target
      const bufferSize = Math.floor((sampleRate * chunkDurationMs) / 1000 / 2) // Divide by 2 because we process in chunks
      const processorSize = Math.max(2048, Math.min(16384, bufferSize))
      
      processorNode = audioContext.createScriptProcessor(processorSize, 1, 1)

      // Initialize Web Worker for audio processing
      worker = new Worker(new URL('/workers/audio-chunker.worker.ts', window.location.origin), {
        type: 'module',
      })

      // Configure worker
      worker.postMessage({
        type: 'init',
        data: {
          sampleRate,
          chunkDurationMs,
        },
      })

      // Handle worker messages
      worker.onmessage = (event) => {
        const { type, data, timestamp, durationMs } = event.data

        switch (type) {
          case 'chunk':
            if (onChunk && data) {
              onChunk(data, { timestamp, durationMs })
            }
            break
          case 'ready':
            console.log('Audio chunker worker ready, samples per chunk:', event.data.samplesPerChunk)
            break
          case 'error':
            console.error('Audio chunker worker error:', event.data.error)
            break
        }
      }

      worker.onerror = (error) => {
        console.error('Audio chunker worker error:', error)
      }

      // Process audio in chunks
      processorNode.onaudioprocess = (event) => {
        if (!isStreaming || !worker) return

        const inputBuffer = event.inputBuffer
        const inputData = inputBuffer.getChannelData(0)

        // Send audio data to worker for processing
        worker.postMessage({
          type: 'process',
          data: inputData,
        }, [inputData.buffer])
      }

      // Connect nodes
      sourceNode.connect(processorNode)
      processorNode.connect(audioContext.destination)

      isStreaming = true
    } catch (error) {
      console.error('Error starting optimized audio stream:', error)
      
      // Cleanup on error
      if (worker) {
        worker.terminate()
        worker = null
      }
      
      throw error
    }
  }

  const stop = () => {
    if (!isStreaming) return

    isStreaming = false

    // Stop worker
    if (worker) {
      worker.postMessage({ type: 'stop' })
      worker.terminate()
      worker = null
    }

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

  const setChunkDuration = (ms: number) => {
    if (worker && isStreaming) {
      worker.postMessage({
        type: 'init',
        data: {
          sampleRate,
          chunkDurationMs: Math.max(200, Math.min(300, ms)), // Clamp to 200-300ms
        },
      })
    }
  }

  return {
    start,
    stop,
    isStreaming: () => isStreaming,
    setChunkDuration,
  }
}

