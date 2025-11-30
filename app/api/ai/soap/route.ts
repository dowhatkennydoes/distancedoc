// TODO: AI SOAP note generation endpoint
// TODO: Accept transcript, symptoms, demographics, vitals, intake form
// TODO: Generate structured SOAP note using Gemini 1.5 Flash
// TODO: Return JSON with subjective, objective, assessment, plan, risks, followUp, billingCodes
// TODO: Use low temperature and JSON mode
// TODO: Add safety guardrails to prevent hallucinating diagnoses

import { NextRequest } from 'next/server'
import { requireAuth, apiError } from '@/lib/auth/api-protection'
import { getVertexAIClient } from '@/lib/gcp/gcp-vertex'
import { z } from 'zod'
import { rateLimiters } from '@/lib/security/rate-limit'
import { sanitizeString, sanitizeJson } from '@/lib/security/sanitize'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logError, logAudit } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { v4 as uuidv4 } from 'uuid'

// TODO: Input validation schema
const SOAPRequestSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required'),
  symptoms: z.array(z.string()).optional().default([]),
  patientDemographics: z.object({
    age: z.number().int().positive().optional(),
    gender: z.string().optional(),
    medicalHistory: z.string().optional(),
    allergies: z.array(z.string()).optional().default([]),
    currentMedications: z.array(z.string()).optional().default([]),
  }),
  vitals: z
    .object({
      temperature: z.number().optional(),
      bloodPressure: z.string().optional(),
      heartRate: z.number().int().positive().optional(),
      respiratoryRate: z.number().int().positive().optional(),
      oxygenSaturation: z.number().min(0).max(100).optional(),
      weight: z.number().positive().optional(),
      height: z.string().optional(),
    })
    .optional(),
  intakeFormAnswers: z.record(z.any()).optional().default({}),
})

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
    // Rate limiting
    const rateLimitResponse = await rateLimiters.sensitive(request)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }
    
    // Require authentication
    const user = await requireAuth(request)

    // Parse and validate request body (limit size)
    const body = await request.json()
    
    // Limit request body size (1MB max for transcript)
    if (JSON.stringify(body).length > 1024 * 1024) {
      return addSecurityHeaders(apiError('Request body too large', 413))
    }
    
    const validatedData = SOAPRequestSchema.parse(body)
    
    // Sanitize transcript and other text inputs
    validatedData.transcript = sanitizeString(validatedData.transcript, 50000)
    if (validatedData.patientDemographics.medicalHistory) {
      validatedData.patientDemographics.medicalHistory = sanitizeString(
        validatedData.patientDemographics.medicalHistory,
        10000
      )
    }
    validatedData.symptoms = validatedData.symptoms.map(s => sanitizeString(s, 500))
    validatedData.intakeFormAnswers = sanitizeJson(validatedData.intakeFormAnswers)

    // Build prompt with safety guardrails
    const prompt = buildSOAPPrompt(validatedData)

    // Generate SOAP note using Gemini 1.5 Flash
    const vertexAI = getVertexAIClient()
    const model = vertexAI.preview.getGenerativeModel({
      model: 'gemini-1.5-flash',
    })

    const requestConfig = {
      contents: [
        {
          role: 'user' as const,
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2, // Low temperature for accuracy
        maxOutputTokens: 2048,
        responseMimeType: 'application/json', // JSON mode
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_MEDICAL' as const,
          threshold: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const,
          threshold: 'BLOCK_MEDIUM_AND_ABOVE' as const,
        },
      ],
    }

    const [response] = await model.generateContent(requestConfig)
    const responseText = response.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    // Parse JSON response
    let soapNote: SOAPNoteResponse
    try {
      soapNote = JSON.parse(responseText)
    } catch (error) {
      logError('Failed to parse SOAP note JSON', error as Error, undefined, user.id, requestId)
      throw new Error('Failed to generate valid SOAP note format')
    }

    // Validate response structure
    if (!soapNote.subjective || !soapNote.objective || !soapNote.assessment || !soapNote.plan) {
      throw new Error('Generated SOAP note is missing required fields')
    }

    // Ensure arrays are present
    soapNote.risks = soapNote.risks || []
    soapNote.billingCodes = soapNote.billingCodes || []

    logAudit('SOAP_NOTE_GENERATED', 'visit_note', 'ai-generated', user.id, true, {
      requestId,
      model: 'gemini-1.5-flash',
    })

    const response = new Response(JSON.stringify(soapNote), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to generate SOAP note', undefined, requestId))
  }
}

// TODO: Build SOAP note prompt with safety guardrails
function buildSOAPPrompt(data: z.infer<typeof SOAPRequestSchema>): string {
  const { transcript, symptoms, patientDemographics, vitals, intakeFormAnswers } = data

  // Build patient information section
  let patientInfo = 'Patient Information:\n'
  if (patientDemographics.age) {
    patientInfo += `- Age: ${patientDemographics.age}\n`
  }
  if (patientDemographics.gender) {
    patientInfo += `- Gender: ${patientDemographics.gender}\n`
  }
  if (patientDemographics.medicalHistory) {
    patientInfo += `- Medical History: ${patientDemographics.medicalHistory}\n`
  }
  if (patientDemographics.allergies && patientDemographics.allergies.length > 0) {
    patientInfo += `- Allergies: ${patientDemographics.allergies.join(', ')}\n`
  }
  if (patientDemographics.currentMedications && patientDemographics.currentMedications.length > 0) {
    patientInfo += `- Current Medications: ${patientDemographics.currentMedications.join(', ')}\n`
  }

  // Build vitals section
  let vitalsInfo = ''
  if (vitals) {
    vitalsInfo = '\nVital Signs:\n'
    if (vitals.temperature) vitalsInfo += `- Temperature: ${vitals.temperature}°F\n`
    if (vitals.bloodPressure) vitalsInfo += `- Blood Pressure: ${vitals.bloodPressure}\n`
    if (vitals.heartRate) vitalsInfo += `- Heart Rate: ${vitals.heartRate} bpm\n`
    if (vitals.respiratoryRate) vitalsInfo += `- Respiratory Rate: ${vitals.respiratoryRate} /min\n`
    if (vitals.oxygenSaturation) vitalsInfo += `- Oxygen Saturation: ${vitals.oxygenSaturation}%\n`
    if (vitals.weight) vitalsInfo += `- Weight: ${vitals.weight} lbs\n`
    if (vitals.height) vitalsInfo += `- Height: ${vitals.height}\n`
  }

  // Build symptoms section
  const symptomsText = symptoms && symptoms.length > 0 ? `\nReported Symptoms: ${symptoms.join(', ')}\n` : ''

  // Build intake form section
  let intakeText = ''
  if (intakeFormAnswers && Object.keys(intakeFormAnswers).length > 0) {
    intakeText = '\nIntake Form Responses:\n'
    for (const [key, value] of Object.entries(intakeFormAnswers)) {
      intakeText += `- ${key}: ${JSON.stringify(value)}\n`
    }
  }

  const prompt = `You are a medical documentation assistant. Generate a structured SOAP note based on the following clinical information.

${patientInfo}${vitalsInfo}${symptomsText}${intakeText}

Clinical Transcription:
${transcript}

CRITICAL SAFETY RULES:
1. DO NOT invent or hallucinate diagnoses that are not clearly stated or strongly implied in the provided information
2. DO NOT add symptoms, findings, or observations that are not mentioned in the transcript or provided data
3. Only include information that is explicitly stated or can be reasonably inferred from the provided data
4. If a diagnosis is uncertain, state it as a differential diagnosis or "rule out" rather than a definitive diagnosis
5. Use medical terminology accurately and conservatively
6. If information is missing, note it as "not documented" rather than making assumptions

Generate a SOAP note with the following structure. Return ONLY valid JSON, no additional text:

{
  "subjective": "Patient's reported symptoms, chief complaint, and history of present illness based ONLY on the transcript and provided information",
  "objective": "Clinical observations, physical examination findings, and vital signs based ONLY on what is documented. Include only documented findings.",
  "assessment": "Clinical assessment and differential diagnoses based ONLY on the provided information. Do not add diagnoses not mentioned or strongly implied. If uncertain, state 'rule out' or list as differential.",
  "plan": "Treatment plan, medications, referrals, and follow-up instructions based on the assessment",
  "risks": ["List of potential risks or complications based on the documented information"],
  "followUp": "Recommended follow-up schedule and instructions",
  "billingCodes": ["ICD-10 codes for documented conditions only", "CPT codes for documented procedures only"]
}

Remember: Only include information that is explicitly stated or can be reasonably inferred. Do not hallucinate or invent diagnoses, symptoms, or findings.`

  return prompt
}

