/**
 * Gemini Client Utility
 * 
 * Centralized Vertex AI client for Gemini 1.5 Flash
 * Provides optimized configuration for speed and cost
 * 
 * Note: This assumes Vertex AI client is properly initialized elsewhere
 * The actual client initialization should match the pattern:
 * const vertexAI = new VertexAI({ project, location })
 * const model = vertexAI.preview.getGenerativeModel({ model: 'gemini-1.5-flash' })
 */

/**
 * Get Vertex AI client
 * This function should be implemented to return a properly configured Vertex AI client
 * For now, it references the implementation pattern used in the codebase
 */
export function getVertexAIClient() {
  // Re-export from gcp-vertex or use a working implementation
  // This matches the pattern: vertexAI.preview.getGenerativeModel()
  
  // Dynamic require to handle different SDK versions
  try {
    // Try importing from the gcp-vertex module (if implemented)
    const { getVertexAIClient: getClient } = require('@/lib/gcp/gcp-vertex')
    return getClient()
  } catch {
    // Fallback: create a client if the package is available
    try {
      // Using @google-cloud/aiplatform VertexAI class
      const { VertexAI } = require('@google-cloud/aiplatform')
      const projectId = process.env.GCP_PROJECT_ID || 'distancedoc'
      const location = process.env.GCP_REGION || 'us-central1'
      
      return new VertexAI({
        project: projectId,
        location: location,
      })
    } catch (error) {
      throw new Error(
        'Vertex AI client not available. Ensure @google-cloud/aiplatform is installed and configured.'
      )
    }
  }
}

/**
 * Get optimized Gemini 1.5 Flash model configuration
 */
export function getOptimizedGeminiConfig() {
  return {
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0, // Deterministic for speed
      maxOutputTokens: 512, // Shorter for individual sections
      responseMimeType: 'application/json' as const, // JSON mode
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
}

