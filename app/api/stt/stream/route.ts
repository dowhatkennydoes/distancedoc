// TODO: Speech-to-Text streaming endpoint
// TODO: Accept raw audio chunks from WebRTC
// TODO: Stream to Vertex AI Speech-to-Text
// TODO: Append partial and final transcripts to Firestore
// TODO: Return incremental results to frontend via Server-Sent Events
// TODO: Stateless and scalable implementation

import { NextRequest } from 'next/server'
import { apiError } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor, requireDoctorAccessToPatient } from '@/lib/auth/patient-access'
import { enforceTenant } from '@/lib/auth/tenant'
import { appendTranscript } from '@/lib/stt/streaming'
import { SpeechClient } from '@google-cloud/speech'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logError } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { logTranscriptAccess } from '@/lib/logging/audit'
import { prisma } from '@/db/prisma'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

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

// POST endpoint - Start streaming session or send audio chunk
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)
  const requestId = context.requestId
  
  try {
    // SECURITY: Require valid session and role
    const session = await requireSession(request)
    requireRole(session, ['doctor', 'patient'], context)
    
    // Rate limiting: 10 STT chunks per second
    const rateLimitResponse = await firestoreRateLimiters.sttChunks(request, session.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    // Get session ID and consultation ID from headers
    const sessionId = request.headers.get('X-Session-Id')
    const consultationId = request.headers.get('X-Consultation-Id')

    if (!sessionId) {
      return apiError('Session ID required', 400, context.requestId)
    }

    if (!consultationId) {
      return apiError('Consultation ID required', 400, context.requestId)
    }

    // SECURITY: Validate consultation exists and user has access
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: {
          select: {
            id: true,
            clinicId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            clinicId: true,
          },
        },
      },
    })

    if (!consultation) {
      return apiError('Consultation not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation
    enforceTenant(consultation.clinicId, session.clinicId, context)

    // SECURITY: Verify user has access to this consultation
    if (session.role === 'patient') {
      // Patient must own the consultation
      const patient = await prisma.patient.findUnique({
        where: {
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!patient || patient.id !== consultation.patientId) {
        return apiError('Unauthorized: You do not have access to this consultation', 403, context.requestId)
      }
    } else if (session.role === 'doctor') {
      // Doctor must be assigned to the consultation
      const doctor = await prisma.doctor.findUnique({
        where: {
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!doctor || doctor.id !== consultation.doctorId) {
        return apiError('Unauthorized: You do not have access to this consultation', 403, context.requestId)
      }
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
            logError('Error storing transcript in Firestore', error as Error, undefined, session.id, requestId)
          }
        }
      }
    })

    recognizeStream.on('error', (error) => {
      logError('Speech-to-Text streaming error', error as Error, undefined, session.id, requestId)
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

// GET endpoint - Get current transcription for a consultation
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  const requestId = context.requestId
  
  try {
    // SECURITY: Require valid session and role
    const session = await requireSession(request)
    requireRole(session, ['doctor', 'patient'], context)

    const consultationId = request.nextUrl.searchParams.get('consultationId')
    if (!consultationId) {
      return apiError('Consultation ID required', 400, context.requestId)
    }

    // SECURITY: Validate consultation exists and user has access
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        patient: {
          select: {
            id: true,
            clinicId: true,
          },
        },
        doctor: {
          select: {
            id: true,
            clinicId: true,
          },
        },
      },
    })

    if (!consultation) {
      return apiError('Consultation not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation
    enforceTenant(consultation.clinicId, session.clinicId, context)

    // SECURITY: Verify user has access to this consultation
    if (session.role === 'patient') {
      const patient = await prisma.patient.findUnique({
        where: {
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!patient || patient.id !== consultation.patientId) {
        return apiError('Unauthorized: You do not have access to this consultation', 403, context.requestId)
      }
    } else if (session.role === 'doctor') {
      const doctor = await prisma.doctor.findUnique({
        where: {
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!doctor || doctor.id !== consultation.doctorId) {
        return apiError('Unauthorized: You do not have access to this consultation', 403, context.requestId)
      }
    }
    
    // Audit log: Transcript access (PHI-safe - only logs metadata)
    logTranscriptAccess(
      session.id,
      session.clinicId,
      consultationId,
      context.ip,
      request,
      requestId
    ).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

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

// DELETE endpoint - End streaming session
export async function DELETE(request: NextRequest) {
  const context = getGuardContext(request)
  const requestId = context.requestId
  
  try {
    // SECURITY: Require valid session and role
    const session = await requireSession(request)
    requireRole(session, ['doctor', 'patient'], context)
    
    // Rate limiting: 10 STT chunks per second
    const rateLimitResponse = await firestoreRateLimiters.sttChunks(request, session.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    const sessionId = request.headers.get('X-Session-Id')
    if (!sessionId) {
      return apiError('Session ID required', 400, context.requestId)
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
