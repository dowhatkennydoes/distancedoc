/**
 * Transcript Summarization Utilities
 * 
 * Summarizes long transcripts before SOAP generation to:
 * - Reduce token count and API costs
 * - Speed up processing
 * - Focus on key medical information
 * 
 * Uses Gemini 1.5 Flash for fast, cost-effective summarization
 */

// Import shared Gemini client utility
import { getVertexAIClient } from './gemini-client'

// Threshold for summarization (characters)
const SUMMARIZATION_THRESHOLD = 5000 // Summarize if transcript > 5000 characters

// Target summary length (characters)
const TARGET_SUMMARY_LENGTH = 3000 // Target 3000 characters for summary

/**
 * Check if transcript should be summarized
 */
export function shouldSummarize(transcript: string): boolean {
  return transcript.length > SUMMARIZATION_THRESHOLD
}

/**
 * Summarize transcript using Gemini 1.5 Flash
 * Focuses on medical information: symptoms, diagnoses, treatments, observations
 */
export async function summarizeTranscript(
  transcript: string,
  context?: {
    symptoms?: string[]
    patientAge?: number
    patientGender?: string
  }
): Promise<string> {
  const vertexAI = getVertexAIClient()
  const model = vertexAI.preview.getGenerativeModel({
    model: 'gemini-1.5-flash',
  })

  const contextInfo = context
    ? `\n\nPatient Context:\n- Age: ${context.patientAge || 'Not provided'}\n- Gender: ${context.patientGender || 'Not provided'}\n- Reported Symptoms: ${context.symptoms?.join(', ') || 'None'}\n`
    : ''

  const prompt = `You are a medical transcription assistant. Summarize the following clinical consultation transcript, focusing ONLY on medically relevant information.

${contextInfo}

CRITICAL: Include ONLY:
- Patient's chief complaint and symptoms
- Medical history relevant to current visit
- Physical examination findings
- Clinical observations
- Diagnoses discussed
- Treatment plans and medications
- Follow-up instructions

EXCLUDE:
- Casual conversation and greetings
- Filler words and repetitions
- Administrative details
- Non-medical small talk

Target length: Approximately ${TARGET_SUMMARY_LENGTH} characters.

Transcript:
${transcript}

Return ONLY the summarized transcript, no additional commentary or formatting.`

  const requestConfig = {
    contents: [
      {
        role: 'user' as const,
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0, // Deterministic for speed
      maxOutputTokens: 1024, // Limit output for cost control
      responseMimeType: 'text/plain', // Simple text output
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
    const summary = aiResponse.response.candidates?.[0]?.content?.parts?.[0]?.text || transcript
    
    // Fallback: If summary is longer than original, return original
    if (summary.length > transcript.length) {
      return transcript
    }
    
    return summary.trim()
  } catch (error) {
    console.error('Transcript summarization failed, using original:', error)
    // Fallback to original transcript if summarization fails
    return transcript
  }
}

// Import compression function
import { compressTranscript } from './transcript-compression'

/**
 * Preprocess transcript: compress and summarize if needed
 */
export async function preprocessTranscript(
  transcript: string,
  options?: {
    compress?: boolean
    summarize?: boolean
    context?: {
      symptoms?: string[]
      patientAge?: number
      patientGender?: string
    }
  }
): Promise<{ processed: string; wasCompressed: boolean; wasSummarized: boolean }> {
  let processed = transcript
  let wasCompressed = false
  let wasSummarized = false

  // Step 1: Compress if requested
  if (options?.compress !== false) {
    const compressed = compressTranscript(transcript)
    if (compressed.length < transcript.length * 0.9) {
      processed = compressed
      wasCompressed = true
    }
  }

  // Step 2: Summarize if requested and transcript is long
  if (options?.summarize !== false && shouldSummarize(processed)) {
    processed = await summarizeTranscript(processed, options?.context)
    wasSummarized = true
  }

  return {
    processed,
    wasCompressed,
    wasSummarized,
  }
}

