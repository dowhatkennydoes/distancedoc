// TODO: Speech-to-Text streaming endpoint
// TODO: Accept raw audio chunks from WebRTC
// TODO: Stream to Vertex AI Speech-to-Text
// TODO: Append partial and final transcripts to Firestore
// TODO: Return incremental results to frontend via Server-Sent Events
// TODO: Stateless and scalable implementation

import { NextRequest } from 'next/server'
import { requireAuth, apiError } from '@/lib/auth/api-protection'
import { appendTranscript } from '@/lib/stt/streaming'
import { SpeechClient } from '@google-cloud/speech'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logError } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { v4 as uuidv4 } from 'uuid'

// TODO: Initialize Speech-to-Text client (reused across requests)
let speechClient: SpeechClient | null = null

function getSpeechClient(): SpeechClient {
  if (!speechClient) {
    // Initialize with service account from environment
    const serviceAccountJson = process.env.GCP_SERVICE_ACCOUNT
      ? Buffer.from(process.env.GCP_SERVICE_ACCOUNT, 'base64').toString('utf-8')
      : null

    if (serviceAccountJson) {
      const credentials = JSON.parse(serviceAccountJson)
      speechClient = new SpeechClient({
        projectId: process.env.GCP_PROJECT_ID || 'distancedoc',
        credentials,
      })
    } else {
      // Fallback to default credentials (for local dev with gcloud auth)
      speechClient = new SpeechClient({
        projectId: process.env.GCP_PROJECT_ID || 'distancedoc',
      })
    }
  }
  return speechClient
}

// TODO: Store active recognition streams in Firestore (stateless)
// Each session stores its own stream state
interface StreamSession {
  sessionId: string
  consultationId: string
  userId: string
  createdAt: Date
}

// TODO: POST endpoint - Start streaming session or send audio chunk
export async function POST(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Require authentication first (needed for user ID)
    const user = await requireAuth(request)
    
    // Rate limiting: 10 STT chunks per second
    const rateLimitResponse = await firestoreRateLimiters.sttChunks(request, user.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    // Get session ID and consultation ID from headers
    const sessionId = request.headers.get('X-Session-Id')
    const consultationId = request.headers.get('X-Consultation-Id')

    if (!sessionId) {
      return apiError('Session ID required', 400)
    }

    if (!consultationId) {
      return apiError('Consultation ID required', 400)
    }

    // Get audio chunk from request body
    const audioChunk = await request.arrayBuffer()

    if (audioChunk.byteLength === 0) {
      return addSecurityHeaders(apiError('Audio chunk cannot be empty', 400))
    }
    
    // Limit audio chunk size (1MB max)
    if (audioChunk.byteLength > 1024 * 1024) {
      return addSecurityHeaders(apiError('Audio chunk too large', 413))
    }

    // For stateless design, we need to maintain stream state per session
    // In a production environment, consider using Redis or similar for stream state
    // For now, we'll create a new stream for each chunk (not ideal but stateless)
    // Better approach: Use Firestore to track stream state and reuse streams
    
    const speechClient = getSpeechClient()
    
    const config = {
      encoding: 'LINEAR16' as const,
      sampleRateHertz: 16000,
      languageCode: 'en-US',
      enableAutomaticPunctuation: true,
      model: 'medical_conversation',
      useEnhanced: true,
      enableWordTimeOffsets: false,
      enableWordConfidence: false,
    }

    // Create streaming recognize request
    // Note: In a truly stateless system, you'd need to track stream state externally
    // For scalability, consider using a message queue or Redis for stream management
    const recognizeStream = speechClient.streamingRecognize(config)

    // Handle transcription results
    recognizeStream.on('data', async (data) => {
      if (data.results && data.results.length > 0) {
        const result = data.results[0]
        const transcript = result.alternatives?.[0]?.transcript || ''
        const isFinal = result.isFinalTranscript || false

        if (transcript) {
          try {
            // Store transcript in Firestore using utility function
            await appendTranscript(consultationId, transcript, isFinal, sessionId)
          } catch (error) {
            logError('Error storing transcript in Firestore', error as Error, undefined, user.id, requestId)
          }
        }
      }
    })

    recognizeStream.on('error', (error) => {
      logError('Speech-to-Text streaming error', error as Error, undefined, user.id, requestId)
    })

    // Send audio chunk to recognizer
    recognizeStream.write({
      audioContent: Buffer.from(audioChunk),
    })

    // Note: In production, you'd want to keep the stream alive and reuse it
    // For stateless design, each request creates a new stream
    // Consider implementing stream pooling or using a dedicated service

    // Return success immediately (async processing continues)
    const response = new Response(
      JSON.stringify({
        success: true,
        message: 'Audio chunk received and processing',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to process audio', undefined, requestId))
  }
}

// TODO: GET endpoint - Get current transcription for a consultation
export async function GET(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    const user = await requireAuth(request)

    const consultationId = request.nextUrl.searchParams.get('consultationId')
    if (!consultationId) {
      return apiError('Consultation ID required', 400)
    }
    
    // Log consultation view
    const { logConsultationView, getRequestFromNextRequest } = await import('@/lib/security/event-logging')
    await logConsultationView(
      user.id,
      consultationId,
      user.role,
      getRequestFromNextRequest(request),
      requestId
    )

    // Get transcription from Firestore using utility function
    const { getTranscription } = await import('@/lib/stt/streaming')
    const transcription = await getTranscription(consultationId)

    // Get updated timestamp
    const { getFirestoreClient } = await import('@/lib/firestore/client')
    const { doc, getDoc } = await import('firebase/firestore')
    const firestore = getFirestoreClient()
    const consultationRef = doc(firestore, 'consultations', consultationId)
    const consultationDoc = await getDoc(consultationRef)
    const data = consultationDoc.data()

    const response = new Response(
      JSON.stringify({
        consultationId,
        transcription,
        updatedAt: data?.transcriptionUpdatedAt?.toDate?.() || null,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to get transcription', undefined, requestId))
  }
}

// TODO: DELETE endpoint - End streaming session
export async function DELETE(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Require authentication first (needed for user ID)
    const user = await requireAuth(request)
    
    // Rate limiting: 10 STT chunks per second
    const rateLimitResponse = await firestoreRateLimiters.sttChunks(request, user.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    const sessionId = request.headers.get('X-Session-Id')
    if (!sessionId) {
      return apiError('Session ID required', 400)
    }

    // Close any active streams (in a real implementation, you'd track these)
    // For stateless design, we rely on Firestore to track session state

    const response = new Response(
      JSON.stringify({
        success: true,
        message: 'Streaming session ended',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to end session', undefined, requestId))
  }
}
