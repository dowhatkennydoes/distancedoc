/**
 * OPTIMIZED AI SOAP Note Generation Endpoint
 * 
 * Optimizations:
 * - Gemini 1.5 Flash as default model
 * - Temperature = 0 for deterministic speed
 * - JSON mode for faster parsing
 * - Transcript compression (remove fillers, timestamps, duplicates)
 * - Transcript summarization for long transcripts
 * - Parallel SOAP section generation
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, apiError } from '@/lib/auth/api-protection'
import { validate } from '@/lib/validation'
import { aiSoapInputSchema, type AiSoapInput } from '@/lib/validation/schemas'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { sanitizeString, sanitizeJson } from '@/lib/security/sanitize'
import { addSecurityHeaders } from '@/lib/security/headers'
import { handleApiError } from '@/lib/security/error-handler'
import { logSOAPNoteGeneration } from '@/lib/logging/audit'
import { compressTranscript } from '@/lib/ai/transcript-compression'
import { preprocessTranscript } from '@/lib/ai/transcript-summarization'
import { generateSOAPNoteParallel, type SOAPContext } from '@/lib/ai/parallel-soap-generation'
import { v4 as uuidv4 } from 'uuid'

// TODO: Output schema
interface SOAPNoteResponse {
  subjective: string
  objective: string
  assessment: string
  plan: string
  risks: string[]
  followUp: string
  billingCodes: string[]
}

// TODO: POST endpoint - Generate SOAP note
export async function POST(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Require authentication first (needed for user ID)
    const user = await requireAuth(request)
    
    // Rate limiting: 10 SOAP generations per minute per doctor
    const rateLimitResponse = await firestoreRateLimiters.soapGeneration(request, user.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    // Parse and validate request body (limit size)
    const body = await request.json()
    
    // Limit request body size (1MB max for transcript)
    if (JSON.stringify(body).length > 1024 * 1024) {
      return addSecurityHeaders(apiError('Request body too large', 413, requestId))
    }
    
    // Validate using centralized schema
    const validatedData = validate(aiSoapInputSchema, body, requestId) as AiSoapInput
    
    // Sanitize transcript and other text inputs
    let transcript = sanitizeString(validatedData.transcript, 50000)
    if (validatedData.patientDemographics.medicalHistory) {
      validatedData.patientDemographics.medicalHistory = sanitizeString(
        validatedData.patientDemographics.medicalHistory,
        10000
      )
    }
    validatedData.symptoms = validatedData.symptoms?.map(s => sanitizeString(s, 500)) || []
    validatedData.intakeFormAnswers = sanitizeJson(validatedData.intakeFormAnswers)

    // OPTIMIZATION: Compress and summarize transcript
    const originalLength = transcript.length
    const preprocessed = await preprocessTranscript(transcript, {
      compress: true, // Always compress
      summarize: true, // Summarize if > 5000 characters
      context: {
        symptoms: validatedData.symptoms,
        patientAge: validatedData.patientDemographics.age,
        patientGender: validatedData.patientDemographics.gender,
      },
    })
    
    transcript = preprocessed.processed
    const compressionRatio = originalLength > 0 ? transcript.length / originalLength : 1
    const tokenReduction = Math.ceil((originalLength - transcript.length) / 4) // Rough estimate: 1 token ≈ 4 chars

    // Build SOAP context
    const soapContext: SOAPContext = {
      transcript,
      symptoms: validatedData.symptoms,
      patientDemographics: validatedData.patientDemographics,
      vitals: validatedData.vitals,
      intakeFormAnswers: validatedData.intakeFormAnswers,
    }

    // OPTIMIZATION: Generate SOAP sections in parallel
    const soapNote = await generateSOAPNoteParallel(soapContext)

    // Validate response structure
    if (!soapNote.subjective || !soapNote.objective || !soapNote.assessment || !soapNote.plan) {
      throw new Error('Generated SOAP note is missing required fields')
    }

    // Ensure arrays are present
    soapNote.risks = soapNote.risks || []
    soapNote.billingCodes = soapNote.billingCodes || []

    // Audit log: SOAP note generation (PHI-safe - only logs metadata)
    logSOAPNoteGeneration(
      user.id,
      user.clinicId || 'unknown',
      'ai-generated',
      {
        model: 'gemini-1.5-flash',
        wasCompressed: preprocessed.wasCompressed,
        wasSummarized: preprocessed.wasSummarized,
        compressionRatio,
        parallelGeneration: true,
      },
      undefined,
      request,
      requestId
    ).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

    const response = NextResponse.json(soapNote, { status: 200 })
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to generate SOAP note', undefined, requestId))
  }
}

// NOTE: Prompt building moved to parallel-soap-generation.ts for parallel section generation
// Legacy function removed - using optimized parallel generation instead

