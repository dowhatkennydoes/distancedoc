/**
 * Parallel SOAP Section Generation
 * 
 * Generates SOAP note sections in parallel using Gemini 1.5 Flash
 * Significantly reduces latency by generating sections concurrently
 * 
 * Strategy:
 * - Subjective: Patient-reported information
 * - Objective: Clinical observations
 * - Assessment: Diagnosis and clinical reasoning
 * - Plan: Treatment and follow-up
 */

// Import shared Gemini client utility
import { getVertexAIClient } from './gemini-client'

export interface SOAPContext {
  transcript: string
  symptoms?: string[]
  patientDemographics: {
    age?: number
    gender?: string
    medicalHistory?: string
    allergies?: string[]
    currentMedications?: string[]
  }
  vitals?: {
    temperature?: number
    bloodPressure?: string
    heartRate?: number
    respiratoryRate?: number
    oxygenSaturation?: number
    weight?: number
    height?: string
  }
  intakeFormAnswers?: Record<string, any>
}

export interface SOAPSections {
  subjective: string
  objective: string
  assessment: string
  plan: string
  risks: string[]
  followUp: string
  billingCodes: string[]
}

/**
 * Generate a single SOAP section using Gemini 1.5 Flash
 */
async function generateSOAPSection(
  section: 'subjective' | 'objective' | 'assessment' | 'plan',
  context: SOAPContext
): Promise<string> {
  const vertexAI = getVertexAIClient()
  const model = vertexAI.preview.getGenerativeModel({
    model: 'gemini-1.5-flash',
  })

  const sectionPrompts = {
    subjective: `Extract and summarize the patient's SUBJECTIVE information from the clinical transcript:
- Chief complaint
- History of present illness
- Patient-reported symptoms
- Relevant medical history
- Patient's own words about their condition

Base ONLY on the transcript and provided context. Return a concise summary.`,
    objective: `Extract and summarize the OBJECTIVE clinical findings from the transcript:
- Physical examination findings
- Vital signs
- Clinical observations
- Test results mentioned
- Measurable data

Include ONLY what is explicitly documented. Return a concise summary.`,
    assessment: `Provide the clinical ASSESSMENT based on the transcript:
- Primary diagnosis or diagnoses
- Differential diagnoses if mentioned
- Clinical reasoning
- Risk factors identified

Do NOT invent diagnoses. Only include what is explicitly stated or strongly implied. Return a concise summary.`,
    plan: `Extract the treatment PLAN from the transcript:
- Medications prescribed or discussed
- Treatments recommended
- Referrals mentioned
- Follow-up instructions
- Patient education provided

Base ONLY on what is explicitly stated. Return a concise summary.`,
  }

  // Build context string
  let contextString = `Transcript:\n${context.transcript}\n\n`
  
  if (context.symptoms && context.symptoms.length > 0) {
    contextString += `Reported Symptoms: ${context.symptoms.join(', ')}\n`
  }
  
  if (context.patientDemographics.age) {
    contextString += `Patient Age: ${context.patientDemographics.age}\n`
  }
  if (context.patientDemographics.gender) {
    contextString += `Patient Gender: ${context.patientDemographics.gender}\n`
  }
  if (context.patientDemographics.medicalHistory) {
    contextString += `Medical History: ${context.patientDemographics.medicalHistory}\n`
  }
  
  if (context.vitals) {
    contextString += `\nVital Signs:\n`
    if (context.vitals.temperature) contextString += `- Temperature: ${context.vitals.temperature}°F\n`
    if (context.vitals.bloodPressure) contextString += `- Blood Pressure: ${context.vitals.bloodPressure}\n`
    if (context.vitals.heartRate) contextString += `- Heart Rate: ${context.vitals.heartRate} bpm\n`
    if (context.vitals.respiratoryRate) contextString += `- Respiratory Rate: ${context.vitals.respiratoryRate} /min\n`
    if (context.vitals.oxygenSaturation) contextString += `- Oxygen Saturation: ${context.vitals.oxygenSaturation}%\n`
  }

  const prompt = `${sectionPrompts[section]}

${contextString}

CRITICAL: Only include information explicitly stated in the transcript or provided context. Do not invent or assume information. Return ONLY the requested section content, no JSON or additional formatting.`

  const requestConfig = {
    contents: [
      {
        role: 'user' as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0, // Deterministic for speed and consistency
      maxOutputTokens: 512, // Shorter tokens for individual sections
      responseMimeType: 'text/plain', // Plain text for each section
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

  try {
    const [aiResponse] = await model.generateContent(requestConfig)
    return aiResponse.response.candidates?.[0]?.content?.parts?.[0]?.text || ''
  } catch (error) {
    console.error(`Failed to generate ${section} section:`, error)
    return ''
  }
}

/**
 * Generate risks, follow-up, and billing codes
 */
async function generateSOAPMetadata(
  context: SOAPContext,
  assessment: string,
  plan: string
): Promise<{ risks: string[]; followUp: string; billingCodes: string[] }> {
  const vertexAI = getVertexAIClient()
  const model = vertexAI.preview.getGenerativeModel({
    model: 'gemini-1.5-flash',
  })

  const prompt = `Based on the following clinical assessment and treatment plan, generate:
1. Potential risks or complications (as JSON array of strings)
2. Follow-up instructions (as a string)
3. Relevant billing codes (ICD-10 and CPT codes as JSON array of strings)

Assessment: ${assessment}

Plan: ${plan}

Return ONLY valid JSON in this format:
{
  "risks": ["risk1", "risk2"],
  "followUp": "follow-up instructions",
  "billingCodes": ["ICD10-CODE", "CPT-CODE"]
}

Only include codes that are clearly applicable to the documented conditions and procedures.`

  const requestConfig = {
    contents: [
      {
        role: 'user' as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 512,
      responseMimeType: 'application/json',
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_MEDICAL' as const,
        threshold: 'BLOCK_MEDIUM_AND_ABOVE' as const,
      },
    ],
  }

  try {
    const [aiResponse] = await model.generateContent(requestConfig)
    const responseText = aiResponse.response.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
    const metadata = JSON.parse(responseText)
    
    return {
      risks: Array.isArray(metadata.risks) ? metadata.risks : [],
      followUp: metadata.followUp || '',
      billingCodes: Array.isArray(metadata.billingCodes) ? metadata.billingCodes : [],
    }
  } catch (error) {
    console.error('Failed to generate SOAP metadata:', error)
    return {
      risks: [],
      followUp: '',
      billingCodes: [],
    }
  }
}

/**
 * Generate complete SOAP note in parallel
 * Generates subjective, objective, assessment, and plan concurrently
 */
export async function generateSOAPNoteParallel(
  context: SOAPContext
): Promise<SOAPSections> {
  // Generate main sections in parallel (4 concurrent requests)
  const [subjective, objective, assessment, plan] = await Promise.all([
    generateSOAPSection('subjective', context),
    generateSOAPSection('objective', context),
    generateSOAPSection('assessment', context),
    generateSOAPSection('plan', context),
  ])

  // Generate metadata (risks, follow-up, billing codes) after we have assessment and plan
  const metadata = await generateSOAPMetadata(context, assessment, plan)

  return {
    subjective,
    objective,
    assessment,
    plan,
    risks: metadata.risks,
    followUp: metadata.followUp,
    billingCodes: metadata.billingCodes,
  }
}

