/**
 * Audio Chunking Web Worker
 * 
 * Processes audio in a separate thread to avoid blocking UI
 * Optimized for 200-300ms chunks
 */

// Worker receives audio data and processes it
self.onmessage = (event: MessageEvent) => {
  const { type, data } = event.data

  switch (type) {
    case 'process': {
      processAudioChunk(data)
      break
    }
    case 'init': {
      handleInit(data)
      break
    }
    case 'stop': {
      cleanup()
      break
    }
  }
}

interface AudioChunkerConfig {
  sampleRate: number
  chunkDurationMs: number // Target chunk duration in milliseconds (200-300ms)
}

let config: AudioChunkerConfig = {
  sampleRate: 16000,
  chunkDurationMs: 250, // Default 250ms (middle of 200-300ms range)
}

let audioBuffer: Float32Array[] = []
let samplesPerChunk: number
let currentChunkSamples: number = 0

function handleInit(workerConfig: AudioChunkerConfig) {
  config = workerConfig
  
  // Calculate samples per chunk
  // For 250ms at 16kHz: 16000 * 0.25 = 4000 samples
  samplesPerChunk = Math.floor((config.sampleRate * config.chunkDurationMs) / 1000)
  currentChunkSamples = 0
  audioBuffer = []
  
  self.postMessage({
    type: 'ready',
    samplesPerChunk,
  })
}

function processAudioChunk(audioData: Float32Array) {
  // Accumulate audio samples
  const samplesNeeded = samplesPerChunk - currentChunkSamples
  
  if (audioData.length <= samplesNeeded) {
    // Full chunk not yet complete, just accumulate
    audioBuffer.push(new Float32Array(audioData))
    currentChunkSamples += audioData.length
    
    // Check if we've accumulated enough for a chunk
    if (currentChunkSamples >= samplesPerChunk) {
      emitChunk()
    }
  } else {
    // We have more data than needed, split it
    const chunkPart = audioData.subarray(0, samplesNeeded)
    const remaining = audioData.subarray(samplesNeeded)
    
    audioBuffer.push(new Float32Array(chunkPart))
    currentChunkSamples += chunkPart.length
    
    // Emit current chunk
    emitChunk()
    
    // Process remaining data recursively
    if (remaining.length > 0) {
      processAudioChunk(remaining)
    }
  }
}

function emitChunk() {
  if (audioBuffer.length === 0) return
  
  // Combine all buffered samples into single Float32Array
  const totalSamples = audioBuffer.reduce((sum, arr) => sum + arr.length, 0)
  const combined = new Float32Array(totalSamples)
  
  let offset = 0
  for (const arr of audioBuffer) {
    combined.set(arr, offset)
    offset += arr.length
  }
  
  // Convert Float32Array to Int16Array (PCM format)
  const int16Data = new Int16Array(combined.length)
  for (let i = 0; i < combined.length; i++) {
    // Clamp and convert to 16-bit integer
    const s = Math.max(-1, Math.min(1, combined[i]))
    int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  
  // Send chunk back to main thread
  self.postMessage({
    type: 'chunk',
    data: int16Data.buffer,
    timestamp: Date.now(),
    samples: combined.length,
    durationMs: (combined.length / config.sampleRate) * 1000,
  }, [int16Data.buffer])
  
  // Reset buffer
  audioBuffer = []
  currentChunkSamples = 0
}

function cleanup() {
  audioBuffer = []
  currentChunkSamples = 0
  self.postMessage({ type: 'stopped' })
}

