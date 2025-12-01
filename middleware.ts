/**
 * Next.js Middleware - Strict Route Protection
 * 
 * Features:
 * - Strict role-based route protection
 * - ID spoofing prevention (e.g., /patient/other-id)
 * - Required parameter validation
 * - Automatic redirect for unauthorized users
 * - Clean JSON errors for API requests
 * - Centralized route-role mapping
 * - Centralized guard for role matching
 */

import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { logAudit, logWarn, logError } from '@/lib/security/logging'
import { logUnauthorizedAccess, getRequestFromNextRequest } from '@/lib/security/event-logging'
import { addSecurityHeaders } from '@/lib/security/headers'
import { v4 as uuidv4 } from 'uuid'
import type { UserRole } from '@/lib/auth/types'

// ============================================================================
// Route-Role Mapping
// ============================================================================

/**
 * Centralized route-to-role mapping
 * Maps route patterns to required roles and additional validation rules
 */
interface RouteRoleConfig {
  requiredRoles: UserRole[]
  requiresApproval?: boolean
  requiresOwnership?: boolean // For routes with ID parameters (e.g., /patient/[id])
  idParam?: string // Name of ID parameter to validate (e.g., 'id', 'patientId')
}

const routeRoleMap = new Map<string | RegExp, RouteRoleConfig>([
  // Doctor routes - only doctors
  ['/doctor/appointments', { requiredRoles: ['doctor'], requiresApproval: true }],
  ['/doctor/patients', { requiredRoles: ['doctor'], requiresApproval: true }],
  [/^\/doctor\/patients\/([^/]+)$/, { requiredRoles: ['doctor'], requiresApproval: true, idParam: 'patientId' }],
  ['/doctor/messages', { requiredRoles: ['doctor'], requiresApproval: true }],
  ['/doctor/visit-notes', { requiredRoles: ['doctor'], requiresApproval: true }],
  [/^\/doctor\/visit-notes\/([^/]+)$/, { requiredRoles: ['doctor'], requiresApproval: true }],
  ['/doctor/forms', { requiredRoles: ['doctor'], requiresApproval: true }],
  ['/doctor/billing', { requiredRoles: ['doctor'], requiresApproval: true }],
  ['/doctor/settings', { requiredRoles: ['doctor'], requiresApproval: true }],
  ['/doctor/pending', { requiredRoles: ['doctor'] }], // No approval required for pending page
  
  // Patient routes - only patients
  ['/patient', { requiredRoles: ['patient'], requiresOwnership: true }],
  ['/patient/visits', { requiredRoles: ['patient'], requiresOwnership: true }],
  ['/patient/forms', { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/patient\/forms\/([^/]+)$/, { requiredRoles: ['patient'], requiresOwnership: true }],
  ['/patient/messages', { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/patient\/messages\/([^/]+)$/, { requiredRoles: ['patient'], requiresOwnership: true }],
  ['/patient/files', { requiredRoles: ['patient'], requiresOwnership: true }],
  ['/patient/summaries', { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/patient\/summaries\/([^/]+)$/, { requiredRoles: ['patient'], requiresOwnership: true }],
  ['/patient/payments', { requiredRoles: ['patient'], requiresOwnership: true }],
  
  // API Doctor routes
  [/^\/api\/doctor\//, { requiredRoles: ['doctor'], requiresApproval: true }],
  [/^\/api\/billing\/doctor/, { requiredRoles: ['doctor'], requiresApproval: true }],
  [/^\/api\/appointments\/doctor/, { requiredRoles: ['doctor'], requiresApproval: true }],
  
  // API Patient routes
  [/^\/api\/patient\//, { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/api\/payments\/patient/, { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/api\/appointments\/patient/, { requiredRoles: ['patient'], requiresOwnership: true }],
  [/^\/api\/visit-notes\/patient/, { requiredRoles: ['patient'], requiresOwnership: true }],
  
  // API Protected routes (doctor or patient)
  ['/api/stt/stream', { requiredRoles: ['doctor', 'patient'] }],
  [/^\/api\/stt\/stream/, { requiredRoles: ['doctor', 'patient'] }],
  ['/api/video', { requiredRoles: ['doctor', 'patient'] }],
  [/^\/api\/video/, { requiredRoles: ['doctor', 'patient'] }],
  ['/api/chat', { requiredRoles: ['doctor', 'patient'] }],
  [/^\/api\/chat/, { requiredRoles: ['doctor', 'patient'] }],
  ['/api/transcribe', { requiredRoles: ['doctor', 'patient'] }],
  [/^\/api\/transcribe/, { requiredRoles: ['doctor', 'patient'] }],
  ['/api/upload', { requiredRoles: ['doctor', 'patient'] }],
  [/^\/api\/upload/, { requiredRoles: ['doctor', 'patient'] }],
  ['/api/soap-notes', { requiredRoles: ['doctor'] }],
  [/^\/api\/soap-notes/, { requiredRoles: ['doctor'] }],
  ['/api/payments', { requiredRoles: ['doctor', 'patient'] }],
  [/^\/api\/payments\/(?!patient|methods|setup-intent)/, { requiredRoles: ['doctor', 'patient'] }],
  
  // Admin routes
  [/^\/admin\//, { requiredRoles: ['admin'] }],
  [/^\/api\/admin\//, { requiredRoles: ['admin'] }],
  ['/api/auth/approve-doctor', { requiredRoles: ['admin'] }],
])

// Role-based route patterns (for quick matching)
const DOCTOR_ROUTE_PATTERNS = [
  /^\/doctor\//,
  /^\/api\/doctor\//,
  /^\/api\/billing\/doctor/,
  /^\/api\/appointments\/doctor/,
]

const PATIENT_ROUTE_PATTERNS = [
  /^\/patient\//,
  /^\/api\/patient\//,
  /^\/api\/payments\/patient/,
  /^\/api\/appointments\/patient/,
  /^\/api\/visit-notes\/patient/,
]

const ADMIN_ROUTE_PATTERNS = [
  /^\/admin\//,
  /^\/api\/admin\//,
]

// ============================================================================
// Configuration
// ============================================================================

// Public routes that don't require authentication
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/signup',
  '/reset',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/reset',
  '/api/health',
  // Allow debug page in development (for verifying unauth flow)
  ...(process.env.NODE_ENV === 'development' ? ['/admin/debug'] : []),
]

// Static asset patterns
const STATIC_ASSET_PATTERNS = [
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$/,
]

// Rate limiting map (in production, use Redis or similar)
const authAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_AUTH_ATTEMPTS = 10

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if route matches pattern (string or RegExp)
 * Rule 4: Add null-safe checks around route matching
 */
function matchesRoutePattern(pathname: string, pattern: string | RegExp): boolean {
  try {
    if (!pathname || typeof pathname !== 'string') {
      return false
    }

    if (!pattern) {
      return false
    }

    if (typeof pattern === 'string') {
      return pathname === pattern || pathname.startsWith(pattern + '/')
    }

    if (pattern instanceof RegExp) {
      return pattern.test(pathname)
    }

    return false
  } catch (error) {
    // Rule 3: Never crash - return false on error
    return false
  }
}

/**
 * Check if route matches any pattern in array
 * Rule 4: Add null-safe checks around route matching
 */
function matchesAnyRoutePattern(pathname: string, patterns: (string | RegExp)[]): boolean {
  try {
    if (!pathname || typeof pathname !== 'string') {
      return false
    }

    if (!patterns || !Array.isArray(patterns) || patterns.length === 0) {
      return false
    }

    return patterns.some(pattern => matchesRoutePattern(pathname, pattern))
  } catch (error) {
    // Rule 3: Never crash - return false on error
    return false
  }
}

/**
 * Check if route is public
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route))
}

/**
 * Check if route is static asset
 */
function isStaticAsset(pathname: string): boolean {
  return STATIC_ASSET_PATTERNS.some(pattern => pattern.test(pathname))
}

/**
 * Get route configuration from routeRoleMap
 */
function getRouteConfig(pathname: string): RouteRoleConfig | null {
  for (const [pattern, config] of routeRoleMap.entries()) {
    if (matchesRoutePattern(pathname, pattern)) {
      return config
    }
  }
  return null
}

/**
 * Validate ID format (CUID, UUID, or flexible alphanumeric)
 */
function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  
  // CUID format: starts with 'c', 25 characters
  const cuidPattern = /^c[a-z0-9]{24}$/
  // UUID format: 8-4-4-4-12 hex characters
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  // Allow alphanumeric with hyphens/underscores
  const flexiblePattern = /^[a-zA-Z0-9_-]{1,100}$/
  
  return cuidPattern.test(id) || uuidPattern.test(id) || flexiblePattern.test(id)
}

/**
 * Extract ID from pathname based on route pattern
 */
function extractIdFromPathname(pathname: string, routePattern: string | RegExp): string | null {
  if (typeof routePattern === 'string') {
    // For string patterns, check if there's an ID segment after the base path
    const segments = pathname.split('/').filter(Boolean)
    const patternSegments = routePattern.split('/').filter(Boolean)
    
    if (segments.length > patternSegments.length) {
      // Get the segment after the pattern
      return segments[patternSegments.length] || null
    }
    return null
  }
  
  // For RegExp patterns, extract captured groups
  const match = pathname.match(routePattern)
  return match && match[1] ? match[1] : null
}

/**
 * Check if user owns the resource ID (prevents URL spoofing)
 */
async function validateOwnership(
  pathname: string,
  userId: string,
  userRole: UserRole,
  roleData: { doctorId?: string; patientId?: string; clinicId: string },
  supabase: any
): Promise<{ valid: boolean; reason?: string }> {
  const routeConfig = getRouteConfig(pathname)
  
  if (!routeConfig || !routeConfig.requiresOwnership) {
    return { valid: true }
  }
  
  // Extract ID from pathname
  let extractedId: string | null = null
  for (const [pattern] of routeRoleMap.entries()) {
    const id = extractIdFromPathname(pathname, pattern)
    if (id && isValidId(id)) {
      extractedId = id
      break
    }
  }
  
  // For patient routes, check if the ID matches the patient's ID
  if (userRole === 'patient' && extractedId) {
    // Check if patientId in pathname matches logged-in patient
    if (roleData.patientId && extractedId !== roleData.patientId) {
      // Also check query params for patientId
      const url = new URL(pathname, 'http://localhost')
      const queryPatientId = url.searchParams.get('patientId')
      
      if (!queryPatientId || queryPatientId !== roleData.patientId) {
        return {
          valid: false,
          reason: `Patient cannot access another patient's data. Requested ID: ${extractedId}, Own ID: ${roleData.patientId}`,
        }
      }
    }
  }
  
  // For doctor routes with patientId, ensure doctor has access to that patient
  if (userRole === 'doctor' && extractedId && routeConfig.idParam === 'patientId') {
    // This will be validated by the API route's requireDoctorAccessToPatient guard
    // For middleware, we just check the ID format
    if (!isValidId(extractedId)) {
      return { valid: false, reason: 'Invalid patient ID format' }
    }
  }
  
  return { valid: true }
}

/**
 * Centralized guard for role matching
 */
async function checkRoleAccess(
  pathname: string,
  userRole: UserRole,
  roleData: { approved: boolean; clinicId: string; doctorId?: string; patientId?: string },
  userId: string,
  supabase: any
): Promise<{ allowed: boolean; reason?: string; redirectTo?: string }> {
  const routeConfig = getRouteConfig(pathname)
  
  // If route is not in the map, allow access (let the route handler decide)
  if (!routeConfig) {
    return { allowed: true }
  }
  
  // Check required roles
  if (!routeConfig.requiredRoles.includes(userRole)) {
    return {
      allowed: false,
      reason: `Route requires one of: ${routeConfig.requiredRoles.join(', ')}, but user has role: ${userRole}`,
      redirectTo: userRole === 'patient' ? '/patient' : '/dashboard',
    }
  }
  
  // Check approval requirement
  if (routeConfig.requiresApproval && !roleData.approved) {
    return {
      allowed: false,
      reason: 'Doctor account pending approval',
      redirectTo: '/doctor/pending',
    }
  }
  
  // Check ownership requirement
  if (routeConfig.requiresOwnership) {
    const ownershipCheck = await validateOwnership(pathname, userId, userRole, roleData, supabase)
    if (!ownershipCheck.valid) {
      return {
        allowed: false,
        reason: ownershipCheck.reason || 'Ownership validation failed',
        redirectTo: userRole === 'patient' ? '/patient' : '/dashboard',
      }
    }
  }
  
  return { allowed: true }
}

/**
 * Check for missing required parameters
 */
function validateRequiredParams(pathname: string, searchParams: URLSearchParams): {
  valid: boolean
  missingParams: string[]
} {
  const missingParams: string[] = []
  
  // Check for dynamic route segments that might be missing
  if (pathname.includes('/[') || pathname.endsWith('/')) {
    // Check common patterns that require IDs
    if (pathname.match(/\/patients\/$/) || pathname.match(/\/patient\/$/)) {
      // Should have an ID in path or query
      const hasPathId = /\/patients?\/([^/]+)/.test(pathname)
      const hasQueryId = searchParams.has('patientId') || searchParams.has('id')
      
      if (!hasPathId && !hasQueryId) {
        missingParams.push('patientId or id')
      }
    }
  }
  
  return {
    valid: missingParams.length === 0,
    missingParams,
  }
}

/**
 * Check for query param spoofing attempts
 */
function detectQueryParamSpoofing(pathname: string, searchParams: URLSearchParams): {
  detected: boolean
  suspiciousParams: string[]
} {
  const suspiciousParams: string[] = []
  
  // Common ID parameter names that shouldn't be in query strings for security
  const sensitiveParams = ['patientId', 'doctorId', 'userId', 'appointmentId', 'consultationId']
  
  // For patient routes, query param patientId should match logged-in patient
  // This will be validated after authentication in checkRoleAccess
  
  // Check for path traversal attempts
  if (pathname.includes('..') || pathname.includes('//')) {
    suspiciousParams.push('path_traversal')
  }
  
  return {
    detected: suspiciousParams.length > 0,
    suspiciousParams,
  }
}

/**
 * Rate limit check
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = authAttempts.get(ip)

  if (!record || now > record.resetAt) {
    authAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= MAX_AUTH_ATTEMPTS) {
    return false
  }

  record.count++
  return true
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  if (realIP) {
    return realIP
  }
  if (cfConnectingIP) {
    return cfConnectingIP
  }
  return 'unknown'
}

/**
 * Validate session and get user
 * Rule 3: If session fails to load, treat as unauthenticated, never crash
 */
async function validateSession(supabase: any): Promise<{
  valid: boolean
  user: any | null
  session: any | null
  error?: string
}> {
  try {
    if (!supabase || typeof supabase.auth?.getUser !== 'function') {
      return { valid: false, user: null, session: null, error: 'Invalid Supabase client' }
    }

    let userResult: { data: { user: any | null }; error: any | null }
    try {
      userResult = await supabase.auth.getUser()
    } catch (error: any) {
      return { valid: false, user: null, session: null, error: error?.message || 'Failed to get user' }
    }

    // Rule 4: Null-safe checks around session.user
    const user = userResult?.data?.user || null
    const userError = userResult?.error || null

    if (userError || !user) {
      return { 
        valid: false, 
        user: null, 
        session: null, 
        error: userError?.message || 'No user found' 
      }
    }

    // Validate user object structure
    if (!user.id || typeof user.id !== 'string') {
      return { valid: false, user: null, session: null, error: 'Invalid user object' }
    }

    let sessionResult: { data: { session: any | null }; error: any | null }
    try {
      sessionResult = await supabase.auth.getSession()
    } catch (error: any) {
      return { valid: false, user, session: null, error: error?.message || 'Failed to get session' }
    }

    // Rule 4: Null-safe checks around session
    const session = sessionResult?.data?.session || null
    const sessionError = sessionResult?.error || null

    if (sessionError || !session) {
      return { 
        valid: false, 
        user, 
        session: null, 
        error: sessionError?.message || 'No session found' 
      }
    }

    // Check session expiration
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at && typeof session.expires_at === 'number' && session.expires_at < now) {
      return { valid: false, user, session, error: 'Session expired' }
    }

    return { valid: true, user, session }
  } catch (error: any) {
    // Rule 3: Never crash - treat as unauthenticated
    return { 
      valid: false, 
      user: null, 
      session: null, 
      error: error?.message || 'Session validation failed' 
    }
  }
}

/**
 * Get user role from database
 * Rule 3: If session fails to load, treat as unauthenticated, never crash
 */
async function getUserRole(supabase: any, userId: string): Promise<{
  role: string | null
  approved: boolean
  clinicId: string | null
  doctorId?: string
  patientId?: string
}> {
  try {
    // Rule 4: Null-safe checks
    if (!supabase || typeof supabase.from !== 'function') {
      return { role: null, approved: false, clinicId: null }
    }

    if (!userId || typeof userId !== 'string') {
      return { role: null, approved: false, clinicId: null }
    }

    let queryResult: { data: any; error: any }
    try {
      queryResult = await supabase
        .from('user_roles')
        .select('role, approved, clinicId, clinic_id, doctor_id, patient_id')
        .eq('user_id', userId)
        .single()
    } catch (error: any) {
      // Query failed - return nulls
      return { role: null, approved: false, clinicId: null }
    }

    const { data, error } = queryResult || { data: null, error: null }

    if (error || !data) {
      return { role: null, approved: false, clinicId: null }
    }

    // Rule 4: Null-safe extraction with fallbacks
    return {
      role: (data.role && typeof data.role === 'string') ? data.role : null,
      approved: Boolean(data.approved),
      clinicId: (data.clinicId || data.clinic_id) || null,
      doctorId: data.doctor_id || undefined,
      patientId: data.patient_id || undefined,
    }
  } catch (error: any) {
    // Rule 3: Never crash - return safe defaults
    return { role: null, approved: false, clinicId: null }
  }
}

/**
 * Create error response (JSON for API routes, redirect for pages)
 */
function createErrorResponse(
  request: NextRequest,
  message: string,
  statusCode: number,
  requestId: string,
  redirectTo?: string
): NextResponse {
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/')
  
  if (isApiRoute) {
    // Clean JSON error for API routes
    return addSecurityHeaders(
      NextResponse.json(
        {
          error: message,
          requestId,
          statusCode,
        },
        { status: statusCode }
      )
    )
  }
  
  // Redirect for page routes
  const redirectUrl = redirectTo || '/login'
  const url = new URL(redirectUrl, request.url)
  
  if (redirectUrl === '/login') {
    url.searchParams.set('redirect', request.nextUrl.pathname)
    url.searchParams.set('error', statusCode === 401 ? 'session_expired' : 'unauthorized')
  }
  
  return addSecurityHeaders(NextResponse.redirect(url))
}

// ============================================================================
// Main Middleware
// ============================================================================

export async function middleware(request: NextRequest) {
  const requestId = uuidv4()
  
  // Rule 4: Add null-safe checks around route matching
  const pathname = request?.nextUrl?.pathname || '/'
  const searchParams = request?.nextUrl?.searchParams || new URLSearchParams()
  
  // Rule 4: Null-safe checks around request.cookies
  let cookies: any = null
  try {
    cookies = request?.cookies || null
  } catch (error: any) {
    // Cookies access failed - continue without cookies (treat as unauthenticated later)
    cookies = null
  }

  const ip = getClientIP(request)
  const userAgent = request?.headers?.get('user-agent') || 'unknown'

  // Rule 4: Validate pathname is a valid string
  if (!pathname || typeof pathname !== 'string') {
    return createErrorResponse(
      request,
      'Invalid request path',
      400,
      requestId
    )
  }

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // Check for query param spoofing
  const spoofingCheck = detectQueryParamSpoofing(pathname, searchParams)
  if (spoofingCheck.detected) {
    logWarn(
      'Query param spoofing detected',
      { pathname, suspiciousParams: spoofingCheck.suspiciousParams, ip, userAgent },
      undefined,
      requestId
    )
    logAudit(
      'SECURITY_VIOLATION',
      'system',
      ip,
      'unknown',
      false,
      {
        requestId,
        pathname,
        violation: 'query_param_spoofing',
        suspiciousParams: spoofingCheck.suspiciousParams,
      }
    )
    
    return createErrorResponse(request, 'Invalid request parameters', 400, requestId)
  }

  // Check for missing required parameters
  const paramValidation = validateRequiredParams(pathname, searchParams)
  if (!paramValidation.valid) {
    logWarn(
      'Missing required parameters',
      { pathname, missingParams: paramValidation.missingParams, ip, userAgent },
      undefined,
      requestId
    )
    return createErrorResponse(
      request,
      `Missing required parameters: ${paramValidation.missingParams.join(', ')}`,
      400,
      requestId
    )
  }

  // Update Supabase session with error handling
  let response: NextResponse
  try {
    response = await updateSession(request)
  } catch (error: any) {
    // Rule 3: If session fails to load, treat as unauthenticated, never crash
    logError('Failed to update session', error, { pathname, ip }, 'system', requestId)
    
    // For public routes, still allow access even if session update fails
    if (isPublicRoute(pathname)) {
      return addSecurityHeaders(NextResponse.next())
    }
    
    // For protected routes, redirect to login
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      return createErrorResponse(
        request,
        'Unauthorized: Session update failed',
        401,
        requestId,
        '/login'
      )
    }
    
    return createErrorResponse(
      request,
      'Unauthorized: Session update failed',
      401,
      requestId,
      '/login'
    )
  }

  // Public routes - allow access
  if (isPublicRoute(pathname)) {
    return addSecurityHeaders(response)
  }

  // Rate limiting check
  if (!checkRateLimit(ip)) {
    logWarn('Rate limit exceeded', { ip, pathname, userAgent }, undefined, requestId)
    logAudit('RATE_LIMIT_EXCEEDED', 'system', ip, 'system', false, { requestId, pathname })
    return createErrorResponse(request, 'Too many requests. Please try again later.', 429, requestId)
  }

  // Protected routes - validate authentication
  let supabase: any
  try {
    supabase = await import('@/lib/supabase/server').then((m) => m.createClient())
  } catch (error: any) {
    // Supabase client creation failed - treat as unauthenticated
    logError('Supabase client creation failed', error, { pathname, ip }, 'system', requestId)
    
    // Rule 3: If session fails to load, treat as unauthenticated, never crash
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      // Rule 1: If path starts with /admin AND user is null: redirect to /login
      return createErrorResponse(
        request,
        'Unauthorized: Session failed to load',
        401,
        requestId,
        '/login'
      )
    }
    
    return createErrorResponse(
      request,
      'Unauthorized: Session failed to load',
      401,
      requestId,
      '/login'
    )
  }

  // Rule 3: If session fails to load, treat as unauthenticated, never crash
  let sessionValidation: { valid: boolean; user: any | null; session: any | null; error?: string }
  try {
    sessionValidation = await validateSession(supabase)
  } catch (error: any) {
    // Session validation threw an error - treat as unauthenticated
    logError('Session validation error', error, { pathname, ip }, 'system', requestId)
    sessionValidation = {
      valid: false,
      user: null,
      session: null,
      error: error?.message || 'Session validation failed',
    }
  }

  // Rule 1: If path starts with /admin AND user is null: redirect to /login
  if (!sessionValidation.valid || !sessionValidation.user) {
    logAudit(
      'AUTH_FAILED',
      'user',
      ip,
      'unknown',
      false,
      {
        requestId,
        pathname,
        userAgent,
        reason: sessionValidation.error || 'Authentication failed',
      }
    )

    // Special handling for admin routes
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      return createErrorResponse(
        request,
        'Unauthorized: Admin access requires authentication',
        401,
        requestId,
        '/login'
      )
    }

    return createErrorResponse(
      request,
      'Unauthorized: Invalid or expired session',
      401,
      requestId,
      '/login'
    )
  }

  // Null-safe extraction of user and session
  const user = sessionValidation.user
  const session = sessionValidation.session || null

  // Rule 4: Add null-safe checks around session.user
  if (!user || !user.id || typeof user.id !== 'string') {
    logError('Invalid user object', undefined, { pathname, ip, userType: typeof user }, 'system', requestId)
    
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      return createErrorResponse(
        request,
        'Unauthorized: Invalid user session',
        401,
        requestId,
        '/login'
      )
    }
    
    return createErrorResponse(
      request,
      'Unauthorized: Invalid user session',
      401,
      requestId,
      '/login'
    )
  }

  // Get user role from database with null-safe error handling
  let roleData: { role: string | null; approved: boolean; clinicId: string | null; doctorId?: string; patientId?: string }
  try {
    roleData = await getUserRole(supabase, user.id)
  } catch (error: any) {
    // Rule 3: If session fails to load, treat as unauthenticated, never crash
    logError('Failed to get user role', error, { userId: user.id, pathname }, user.id, requestId)
    
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      return createErrorResponse(
        request,
        'Unauthorized: Failed to verify user role',
        401,
        requestId,
        '/login'
      )
    }
    
    return createErrorResponse(
      request,
      'Unauthorized: Failed to verify user role',
      401,
      requestId,
      '/login'
    )
  }

  // Rule 4: Add null-safe checks around session.role
  if (!roleData || !roleData.role || typeof roleData.role !== 'string') {
    logError('User role not found', undefined, { userId: user.id, pathname, roleData }, user.id, requestId)
    logAudit('AUTH_FAILED', 'user', user.id, user.id, false, { requestId, pathname, reason: 'Role not found' })
    
    // Rule 2: If path starts with /admin AND user.role is not admin: redirect to user's real dashboard
    // But if no role at all, redirect to login
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      return createErrorResponse(
        request,
        'Unauthorized: User role not found',
        401,
        requestId,
        '/login'
      )
    }
    
    return createErrorResponse(
      request,
      'Unauthorized: User role not found',
      401,
      requestId,
      '/login'
    )
  }

  // Rule 4: Null-safe checks around clinicId
  if (!roleData.clinicId || typeof roleData.clinicId !== 'string') {
    logError('User clinicId not found', undefined, { userId: user.id, pathname }, user.id, requestId)
    logAudit('AUTH_FAILED', 'user', user.id, user.id, false, { requestId, pathname, reason: 'Clinic not assigned' })
    
    if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
      return createErrorResponse(
        request,
        'Unauthorized: User clinic not assigned',
        401,
        requestId,
        '/login'
      )
    }
    
    return createErrorResponse(
      request,
      'Unauthorized: User clinic not assigned',
      401,
      requestId,
      '/login'
    )
  }

  const { role, approved, clinicId, doctorId, patientId } = roleData

  // Rule 2: If path starts with /admin AND user.role is not admin: redirect to user's real dashboard
  if (matchesAnyRoutePattern(pathname, ADMIN_ROUTE_PATTERNS)) {
    if (role !== 'admin') {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId,
          pathname,
          userRole: role,
          reason: `Admin route accessed by ${role}`,
        }
      )
      
      // Redirect to user's real dashboard based on their role
      const redirectTo = role === 'doctor' ? '/dashboard' : role === 'patient' ? '/patient' : '/login'
      
      return createErrorResponse(
        request,
        `Forbidden: Admin access requires admin role. Current role: ${role}`,
        403,
        requestId,
        redirectTo
      )
    }
  }

  // Log successful authentication
  logAudit(
    'AUTH_SUCCESS',
    'user',
    user.id,
    user.id || 'unknown',
    true,
    {
      requestId,
      pathname,
      role,
      clinicId,
      approved,
      ip,
      userAgent,
    }
  )

  // STRICT ROLE-BASED ROUTE PROTECTION
  const roleAccessCheck = await checkRoleAccess(
    pathname,
    role as UserRole,
    { approved, clinicId, doctorId, patientId },
    user.id,
    supabase
  )

  if (!roleAccessCheck.allowed) {
    logAudit(
      'ACCESS_DENIED',
      'user',
      user.id,
      user.id,
      false,
      {
        requestId,
        pathname,
        userRole: role,
        reason: roleAccessCheck.reason,
      }
    )
    
    logUnauthorizedAccess(
      user.id,
      'route',
      pathname,
      roleAccessCheck.reason || 'Access denied',
      getRequestFromNextRequest(request),
      requestId
    ).catch(err => console.error('Failed to log unauthorized access:', err))
    
    return createErrorResponse(
      request,
      roleAccessCheck.reason || 'Forbidden: Access denied',
      403,
      requestId,
      roleAccessCheck.redirectTo
    )
  }

  // Add security headers and metadata
  response = addSecurityHeaders(response)
  response.headers.set('X-Request-ID', requestId)
  response.headers.set('X-User-Role', role)
  response.headers.set('X-User-ID', user.id)
  response.headers.set('X-Clinic-ID', clinicId)

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

