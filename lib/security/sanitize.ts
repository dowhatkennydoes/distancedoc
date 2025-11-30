// Input sanitization utilities
// TODO: Sanitize user input to prevent XSS and injection attacks
// TODO: HTML sanitization
// TODO: SQL injection prevention (though Prisma helps)
// TODO: File name sanitization
// TODO: URL sanitization

// Use DOMPurify for HTML sanitization
// In server-side, we'll use a simpler approach
let DOMPurify: any = null

if (typeof window !== 'undefined') {
  // Client-side: use DOMPurify
  DOMPurify = require('dompurify')
} else {
  // Server-side: use a simple HTML tag stripper
  DOMPurify = {
    sanitize: (html: string) => {
      // Remove all HTML tags
      return html.replace(/<[^>]*>/g, '')
    },
  }
}

// Sanitize HTML content
export function sanitizeHtml(html: string): string {
  if (DOMPurify) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [], // No HTML tags allowed by default
      ALLOWED_ATTR: [],
    })
  }
  // Fallback for server-side
  return serverSanitize(html)
}

// Sanitize file name
export function sanitizeFileName(fileName: string): string {
  // Remove path traversal attempts
  let sanitized = fileName.replace(/\.\./g, '')
  
  // Remove leading/trailing dots and slashes
  sanitized = sanitized.replace(/^[.\/]+|[.\/]+$/g, '')
  
  // Replace invalid characters
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_')
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    sanitized = sanitized.substring(0, 255 - ext.length) + ext
  }
  
  return sanitized
}

// Sanitize string input (remove HTML, trim, limit length)
export function sanitizeString(input: string, maxLength: number = 10000): string {
  if (typeof input !== 'string') {
    return ''
  }
  
  // Remove HTML tags
  let sanitized = sanitizeHtml(input)
  
  // Trim whitespace
  sanitized = sanitized.trim()
  
  // Limit length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }
  
  return sanitized
}

// Sanitize JSON input
export function sanitizeJson<T>(data: any, maxDepth: number = 10): T {
  if (maxDepth <= 0) {
    return null as T
  }
  
  if (typeof data === 'string') {
    return sanitizeString(data) as T
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJson(item, maxDepth - 1)) as T
  }
  
  if (data && typeof data === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      // Sanitize key
      const sanitizedKey = sanitizeString(key, 100)
      sanitized[sanitizedKey] = sanitizeJson(value, maxDepth - 1)
    }
    return sanitized as T
  }
  
  return data as T
}

// Validate and sanitize email
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
    return null
  }
  
  const trimmed = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(trimmed)) {
    return null
  }
  
  // Limit length
  if (trimmed.length > 254) {
    return null
  }
  
  return trimmed
}

// Validate and sanitize phone number
export function sanitizePhone(phone: string): string | null {
  if (typeof phone !== 'string') {
    return null
  }
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '')
  
  // Validate length (10-15 digits for international)
  if (digits.length < 10 || digits.length > 15) {
    return null
  }
  
  return digits
}

// Redact PHI from strings
export function redactPHI(text: string): string {
  if (!text || typeof text !== 'string') {
    return ''
  }
  
  // Redact email addresses
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
  
  // Redact phone numbers
  text = text.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
  
  // Redact SSN patterns
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')
  
  // Redact credit card numbers
  text = text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_REDACTED]')
  
  // Redact dates (potential DOB)
  text = text.replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '[DATE_REDACTED]')
  
  return text
}

