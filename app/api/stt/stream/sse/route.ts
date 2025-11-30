// TODO: Server-Sent Events endpoint for real-time transcript updates
// TODO: Stream incremental transcript updates to frontend
// TODO: Listen to Firestore changes for consultation transcription
// TODO: Send updates as they occur

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/auth/api-protection'
import { getFirestoreClient } from '@/lib/firestore/client'
import { doc, onSnapshot } from 'firebase/firestore'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logError } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { v4 as uuidv4 } from 'uuid'

// TODO: GET endpoint - Server-Sent Events stream for transcript updates
export async function GET(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Require authentication first (needed for user ID)
    const user = await requireAuth(request)
    
    // Rate limiting: 10 STT chunks per second
    const rateLimitResponse = await firestoreRateLimiters.sttChunks(request, user.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    const consultationId = request.nextUrl.searchParams.get('consultationId')
    if (!consultationId) {
      return new Response('Consultation ID required', { status: 400 })
    }

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        
        // Send initial connection message
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'connected' })}\n\n`)
        )

        // Listen to Firestore changes
        const firestore = getFirestoreClient()
        const consultationRef = doc(firestore, 'consultations', consultationId)

        const unsubscribe = onSnapshot(
          consultationRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'error', message: 'Consultation not found' })}\n\n`
                )
              )
              return
            }

            const data = snapshot.data()
            const transcription = data?.transcription || []
            const updatedAt = data?.transcriptionUpdatedAt?.toDate?.() || null

            // Send transcript update
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'transcript',
                  transcription,
                  updatedAt: updatedAt?.toISOString() || null,
                })}\n\n`
              )
            )
          },
              (error) => {
                logError('Firestore listener error', error, undefined, undefined, requestId)
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'error', message: 'An error occurred' })}\n\n`
                  )
                )
              }
        )

        // Cleanup on close
        request.signal.addEventListener('abort', () => {
          unsubscribe()
          controller.close()
        })
      },
    })

        const response = new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no', // Disable nginx buffering
          },
        })
        return addSecurityHeaders(response)
      } catch (error: any) {
        return addSecurityHeaders(handleApiError(error, 'Failed to create SSE stream', undefined, requestId))
      }
    }

