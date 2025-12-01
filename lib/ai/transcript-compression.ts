/**
 * Transcript Compression Utilities
 * 
 * Compresses medical transcripts by:
 * - Removing filler words (um, uh, like, etc.)
 * - Removing timestamps
 * - Removing duplicate phrases
 * - Normalizing whitespace
 * 
 * Reduces token count and API costs while preserving medical information
 */

// Common filler words and phrases to remove
const FILLER_WORDS = new Set([
  'um', 'uh', 'hmm', 'er', 'ah', 'oh',
  'like', 'you know', 'well', 'so', 'actually',
  'basically', 'literally', 'kind of', 'sort of',
  'i mean', 'you see', 'right', 'okay', 'ok',
])

// Medical filler phrases to remove
const MEDICAL_FILLERS = new Set([
  'let me see', 'let me think', 'hold on', 'just a second',
  'one moment', 'give me a moment',
])

// Timestamp patterns (various formats)
const TIMESTAMP_PATTERNS = [
  /\[\d{2}:\d{2}:\d{2}\]/g,           // [00:12:34]
  /\d{2}:\d{2}:\d{2}/g,                // 00:12:34
  /\(\d{2}:\d{2}\)/g,                  // (12:34)
  /\[\d{1,2}:\d{2}\]/g,                // [1:23]
  /\d{1,2}:\d{2}(?:\s|$)/g,            // 1:23 (standalone)
  /<\d+>/g,                            // <123> (milliseconds)
]

/**
 * Remove filler words from transcript
 */
function removeFillers(text: string): string {
  const words = text.split(/\s+/)
  const filtered = words.filter(word => {
    const normalized = word.toLowerCase().replace(/[.,!?;:]/g, '')
    return !FILLER_WORDS.has(normalized) && !MEDICAL_FILLERS.has(normalized)
  })
  return filtered.join(' ')
}

/**
 * Remove timestamps from transcript
 */
function removeTimestamps(text: string): string {
  let cleaned = text
  for (const pattern of TIMESTAMP_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ')
  }
  return cleaned
}

/**
 * Remove duplicate consecutive phrases
 * Removes phrases that appear multiple times in a row
 */
function removeDuplicates(text: string): string {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
  const deduplicated: string[] = []
  
  for (let i = 0; i < sentences.length; i++) {
    const current = sentences[i].toLowerCase()
    const previous = i > 0 ? sentences[i - 1].toLowerCase() : ''
    
    // Skip if this sentence is very similar to the previous one (>80% similarity)
    if (previous && calculateSimilarity(current, previous) > 0.8) {
      continue
    }
    
    // Skip if this exact sentence appeared recently
    const recentSentences = deduplicated.slice(-3).map(s => s.toLowerCase())
    if (recentSentences.includes(current)) {
      continue
    }
    
    deduplicated.push(sentences[i])
  }
  
  return deduplicated.join('. ') + '.'
}

/**
 * Calculate similarity between two strings (simple word overlap)
 */
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2))
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * Normalize whitespace and clean up text
 */
function normalizeWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')           // Multiple spaces to single space
    .replace(/\s+([.,!?;:])/g, '$1') // Remove space before punctuation
    .replace(/\n{3,}/g, '\n\n')     // Multiple newlines to double newline
    .trim()
}

/**
 * Compress transcript by removing fillers, timestamps, and duplicates
 * 
 * @param transcript Original transcript text
 * @returns Compressed transcript
 */
export function compressTranscript(transcript: string): string {
  if (!transcript || transcript.length === 0) {
    return transcript
  }
  
  let compressed = transcript
  
  // Step 1: Remove timestamps
  compressed = removeTimestamps(compressed)
  
  // Step 2: Remove filler words (but preserve medical content)
  compressed = removeFillers(compressed)
  
  // Step 3: Remove duplicate phrases
  compressed = removeDuplicates(compressed)
  
  // Step 4: Normalize whitespace
  compressed = normalizeWhitespace(compressed)
  
  return compressed
}

/**
 * Calculate compression ratio
 */
export function getCompressionRatio(original: string, compressed: string): number {
  if (!original || original.length === 0) {
    return 1.0
  }
  return compressed.length / original.length
}

/**
 * Get estimated token reduction (rough estimate: 1 token ≈ 4 characters)
 */
export function estimateTokenReduction(original: string, compressed: string): number {
  const originalTokens = Math.ceil(original.length / 4)
  const compressedTokens = Math.ceil(compressed.length / 4)
  return originalTokens - compressedTokens
}

