/**
 * Next.js Middleware - Enhanced Route Protection
 * 
 * Features:
 * - JWT validation on every request
 * - Session expiry checking
 * - Role-based route protection
 * - Query param spoofing prevention
 * - Invalid/missing ID validation
 * - Unknown route 404 rewriting
 * - Audit logging for all auth events
 * - Security headers enforcement
 * - Rate limiting
 * - Request tracking
 */

import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { logAudit, logWarn, logError } from '@/lib/security/logging'
import { logUnauthorizedAccess, getRequestFromNextRequest } from '@/lib/security/event-logging'
import { addSecurityHeaders } from '@/lib/security/headers'
import { v4 as uuidv4 } from 'uuid'
import { canAccess, getRoutePermission, type Permission } from '@/lib/auth/permissions'
import type { UserRole } from '@/lib/auth/types'

// Rate limiting map (in production, use Redis or similar)
const authAttempts = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const MAX_AUTH_ATTEMPTS = 10

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
]

// Static asset patterns
const STATIC_ASSET_PATTERNS = [
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$/,
]

// Role-based route patterns
const DOCTOR_ROUTES = [
  /^\/doctor\//,
  /^\/dashboard\/doctor\//,
  /^\/api\/doctor\//,
  /^\/api\/billing\/doctor/,
  /^\/api\/appointments\/doctor/,
]

const PATIENT_ROUTES = [
  /^\/patient\//,
  /^\/dashboard\/patient\//,
  /^\/api\/patient\//,
  /^\/api\/payments\/patient/,
  /^\/api\/appointments\/patient/,
  /^\/api\/visit-notes\/patient/,
]

const ADMIN_ROUTES = [
  /^\/admin\//,
  /^\/api\/admin\//,
  /^\/api\/auth\/approve-doctor/,
]

// Valid route patterns (for 404 detection)
const VALID_ROUTE_PATTERNS = [
  // Public routes
  /^\/$/,
  /^\/login$/,
  /^\/signup\/(doctor|patient)$/,
  /^\/reset$/,
  /^\/doctor\/pending$/,
  
  // Doctor routes
  /^\/doctor\/appointments$/,
  /^\/doctor\/patients$/,
  /^\/doctor\/patients\/[a-zA-Z0-9_-]+$/, // Dynamic ID
  /^\/doctor\/messages$/,
  /^\/doctor\/visit-notes$/,
  /^\/doctor\/visit-notes\/[a-zA-Z0-9_-]+$/, // Dynamic ID
  /^\/doctor\/forms$/,
  /^\/doctor\/billing$/,
  /^\/doctor\/settings$/,
  /^\/dashboard$/,
  
  // Patient routes
  /^\/patient$/,
  /^\/patient\/visits$/,
  /^\/patient\/forms$/,
  /^\/patient\/forms\/[a-zA-Z0-9_-]+$/, // Dynamic ID
  /^\/patient\/messages$/,
  /^\/patient\/messages\/[a-zA-Z0-9_-]+$/, // Dynamic ID
  /^\/patient\/files$/,
  /^\/patient\/summaries$/,
  /^\/patient\/summaries\/[a-zA-Z0-9_-]+$/, // Dynamic ID
  /^\/patient\/payments$/,
  
  // API routes
  /^\/api\/auth\//,
  /^\/api\/doctor\//,
  /^\/api\/patient\//,
  /^\/api\/appointments\//,
  /^\/api\/files\//,
  /^\/api\/ai\//,
  /^\/api\/stt\//,
  /^\/api\/chat\//,
  /^\/api\/soap-notes\//,
  /^\/api\/visit-notes\//,
  /^\/api\/payments\//,
  /^\/api\/billing\//,
]

/**
 * Check if route matches pattern
 */
function matchesRoute(pathname: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(pathname))
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
 * Validate ID format (CUID or UUID)
 */
function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false
  
  // CUID format: starts with 'c', 25 characters
  const cuidPattern = /^c[a-z0-9]{24}$/
  // UUID format: 8-4-4-4-12 hex characters
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  // Allow alphanumeric with hyphens/underscores (for flexibility)
  const flexiblePattern = /^[a-zA-Z0-9_-]{1,100}$/
  
  return cuidPattern.test(id) || uuidPattern.test(id) || flexiblePattern.test(id)
}

/**
 * Extract and validate IDs from pathname
 */
function validateRouteIds(pathname: string): { valid: boolean; invalidIds: string[] } {
  const invalidIds: string[] = []
  
  // Match dynamic segments like [id], [patientId], etc.
  const dynamicSegmentPattern = /\/([a-zA-Z0-9_-]+)(?=\/|$)/
  const segments = pathname.split('/').filter(Boolean)
  
  // Check common ID parameter patterns
  const idPatterns = [
    /^patients\/([^/]+)/, // /patients/123
    /^patient\/([^/]+)/,  // /patient/123
    /^doctors\/([^/]+)/,  // /doctors/123
    /^doctor\/([^/]+)/,   // /doctor/123
    /^appointments\/([^/]+)/,
    /^messages\/([^/]+)/,
    /^forms\/([^/]+)/,
    /^summaries\/([^/]+)/,
    /^visit-notes\/([^/]+)/,
    /^files\/([^/]+)/,
  ]
  
  for (const pattern of idPatterns) {
    const match = pathname.match(pattern)
    if (match && match[1]) {
      const id = match[1]
      if (!isValidId(id)) {
        invalidIds.push(id)
      }
    }
  }
  
  // Also check query parameters for IDs
  // This will be handled in the route handler, but we can log suspicious patterns
  
  return {
    valid: invalidIds.length === 0,
    invalidIds,
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
  const sensitiveParams = [
    'patientId',
    'doctorId',
    'userId',
    'appointmentId',
    'consultationId',
    'fileId',
    'noteId',
    'formId',
  ]
  
  // Check if sensitive params are in query string (potential spoofing)
  for (const param of sensitiveParams) {
    if (searchParams.has(param)) {
      // Allow if it's a valid route pattern, otherwise suspicious
      const value = searchParams.get(param)
      if (value && !isValidId(value)) {
        suspiciousParams.push(param)
      }
    }
  }
  
  // Check for path traversal attempts
  if (pathname.includes('..') || pathname.includes('//')) {
    suspiciousParams.push('path_traversal')
  }
  
  // Check for encoded attempts
  if (pathname.includes('%2e%2e') || pathname.includes('%2f%2f')) {
    suspiciousParams.push('encoded_traversal')
  }
  
  return {
    detected: suspiciousParams.length > 0,
    suspiciousParams,
  }
}

/**
 * Check if route is valid (exists in app directory)
 */
function isValidRoute(pathname: string): boolean {
  // Remove query params for validation
  const cleanPath = pathname.split('?')[0]
  
  // Check against known valid patterns
  return VALID_ROUTE_PATTERNS.some(pattern => pattern.test(cleanPath))
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
 * Validate JWT and session
 */
async function validateSession(supabase: any): Promise<{
  valid: boolean
  user: any | null
  session: any | null
  error?: string
}> {
  try {
    // Get user and session
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return { valid: false, user: null, session: null, error: userError?.message || 'No user found' }
    }

    // Get session to check expiry
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      return { valid: false, user, session: null, error: sessionError?.message || 'No session found' }
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at && session.expires_at < now) {
      return { valid: false, user, session, error: 'Session expired' }
    }

    return { valid: true, user, session }
  } catch (error: any) {
    return { valid: false, user: null, session: null, error: error.message || 'Session validation failed' }
  }
}

/**
 * Get user role from database
 */
async function getUserRole(supabase: any, userId: string): Promise<{
  role: string | null
  approved: boolean
  clinicId: string | null
  doctorId?: string
  patientId?: string
}> {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, approved, clinic_id, doctor_id, patient_id')
      .eq('user_id', userId)
      .single()

    if (error || !data) {
      return { role: null, approved: false, clinicId: null }
    }

    return {
      role: data.role || null,
      approved: data.approved || false,
      clinicId: data.clinic_id || null,
      doctorId: data.doctor_id,
      patientId: data.patient_id,
    }
  } catch (error) {
    return { role: null, approved: false, clinicId: null }
  }
}

export async function middleware(request: NextRequest) {
  const requestId = uuidv4()
  const pathname = request.nextUrl.pathname
  const searchParams = request.nextUrl.searchParams
  const ip = getClientIP(request)
  const userAgent = request.headers.get('user-agent') || 'unknown'

  // Skip static assets
  if (isStaticAsset(pathname)) {
    return NextResponse.next()
  }

  // Check for query param spoofing BEFORE authentication
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
    
    // Log unauthorized access attempt
    logUnauthorizedAccess(
      undefined,
      'route',
      pathname,
      `Query param spoofing: ${spoofingCheck.suspiciousParams.join(', ')}`,
      getRequestFromNextRequest(request),
      requestId
    ).catch(err => console.error('Failed to log unauthorized access:', err))
    
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Invalid request parameters', requestId },
        { status: 400 }
      )
    )
  }

  // Validate route IDs
  const idValidation = validateRouteIds(pathname)
  if (!idValidation.valid) {
    logWarn(
      'Invalid ID format detected',
      { pathname, invalidIds: idValidation.invalidIds, ip, userAgent },
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
        violation: 'invalid_id_format',
        invalidIds: idValidation.invalidIds,
      }
    )
    
    // Log unauthorized access attempt
    logUnauthorizedAccess(
      undefined,
      'route',
      pathname,
      `Invalid ID format: ${idValidation.invalidIds.join(', ')}`,
      getRequestFromNextRequest(request),
      requestId
    ).catch(err => console.error('Failed to log unauthorized access:', err))
    
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Invalid resource ID format', requestId },
        { status: 400 }
      )
    )
  }

  // Check if route is valid (404 for unknown routes)
  if (!isPublicRoute(pathname) && !isValidRoute(pathname)) {
    logWarn(
      'Unknown route accessed',
      { pathname, ip, userAgent },
      undefined,
      requestId
    )
    
    // Return 404 for unknown routes
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Not found', requestId },
        { status: 404 }
      )
    )
  }

  // Update Supabase session (handles cookie refresh)
  let response = await updateSession(request)

  // Public routes - allow access
  if (isPublicRoute(pathname)) {
    return addSecurityHeaders(response)
  }

  // Rate limiting check
  if (!checkRateLimit(ip)) {
    logWarn(
      'Rate limit exceeded',
      { ip, pathname, userAgent },
      undefined,
      requestId
    )
    logAudit(
      'RATE_LIMIT_EXCEEDED',
      'system',
      ip,
      'system',
      false,
      { requestId, pathname }
    )
    return addSecurityHeaders(
      NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    )
  }

  // Protected routes - validate authentication
  const supabase = await import('@/lib/supabase/server').then((m) => m.createClient())

  // Validate session and JWT
  const sessionValidation = await validateSession(supabase)

  if (!sessionValidation.valid || !sessionValidation.user) {
    // Log failed auth attempt
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

    // Redirect to login with return URL
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname)
    redirectUrl.searchParams.set('error', 'session_expired')
    return addSecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  const { user, session } = sessionValidation

  // Get user role from database
  const roleData = await getUserRole(supabase, user.id)

  if (!roleData.role) {
    logError(
      'User role not found',
      undefined,
      { userId: user.id, pathname },
      user.id,
      requestId
    )
    logAudit(
      'AUTH_FAILED',
      'user',
      user.id,
      user.id,
      false,
      { requestId, pathname, reason: 'Role not found' }
    )

    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('error', 'role_not_found')
    return addSecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  // Validate clinicId exists
  if (!roleData.clinicId) {
    logError(
      'User clinicId not found',
      undefined,
      { userId: user.id, pathname },
      user.id,
      requestId
    )
    logAudit(
      'AUTH_FAILED',
      'user',
      user.id,
      user.id,
      false,
      { requestId, pathname, reason: 'Clinic not assigned' }
    )

    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('error', 'clinic_not_assigned')
    return addSecurityHeaders(NextResponse.redirect(redirectUrl))
  }

  const { role, approved, clinicId, doctorId, patientId } = roleData

  // Log successful authentication (for audit trail)
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
      clinicId, // Tenant isolation
      approved,
      ip,
      userAgent,
    }
  )

  // ENHANCED ROLE-BASED ROUTE PROTECTION

  // Prevent patients from accessing doctor routes
  if (matchesRoute(pathname, DOCTOR_ROUTES)) {
    if (role === 'patient') {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        { requestId, pathname, requiredRole: 'doctor', userRole: role }
      )
      
      // Log unauthorized access attempt
      logUnauthorizedAccess(
        user.id,
        'doctor_route',
        pathname,
        'Patient attempting to access doctor route',
        getRequestFromNextRequest(request),
        requestId
      ).catch(err => console.error('Failed to log unauthorized access:', err))
      
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/patient', request.url))
      )
    }
    
    if (role !== 'doctor' && role !== 'admin') {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        { requestId, pathname, requiredRole: 'doctor', userRole: role }
      )
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/dashboard', request.url))
      )
    }

    if (role === 'doctor' && !approved) {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        { requestId, pathname, reason: 'Doctor not approved' }
      )
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/doctor/pending', request.url))
      )
    }
  }

  // Prevent doctors from accessing patient routes
  if (matchesRoute(pathname, PATIENT_ROUTES)) {
    if (role === 'doctor') {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        { requestId, pathname, requiredRole: 'patient', userRole: role }
      )
      
      // Log unauthorized access attempt
      logUnauthorizedAccess(
        user.id,
        'patient_route',
        pathname,
        'Doctor attempting to access patient route',
        getRequestFromNextRequest(request),
        requestId
      ).catch(err => console.error('Failed to log unauthorized access:', err))
      
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/dashboard', request.url))
      )
    }
    
    if (role !== 'patient' && role !== 'admin') {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        { requestId, pathname, requiredRole: 'patient', userRole: role }
      )
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/dashboard', request.url))
      )
    }
  }

  // Admin routes
  if (matchesRoute(pathname, ADMIN_ROUTES)) {
    if (role !== 'admin') {
      logAudit(
        'ACCESS_DENIED',
        'user',
        user.id,
        user.id,
        false,
        { requestId, pathname, requiredRole: 'admin', userRole: role }
      )
      return addSecurityHeaders(
        NextResponse.redirect(new URL('/dashboard', request.url))
      )
    }
  }

  // RBAC Permission Check
  // Check if the route requires specific permissions
  const method = request.method
  const routePermission = getRoutePermission(method, pathname)

  if (routePermission) {
    const permissions = Array.isArray(routePermission) ? routePermission : [routePermission]
    const hasPermission = permissions.some(permission => 
      canAccess(role as UserRole, permission as Permission)
    )

    if (!hasPermission) {
      logAudit(
        'PERMISSION_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId,
          pathname,
          method,
          userRole: role,
          requiredPermissions: permissions,
        }
      )

      // Return 403 Forbidden for API routes, redirect for page routes
      if (pathname.startsWith('/api/')) {
        return addSecurityHeaders(
          NextResponse.json(
            { error: 'Forbidden: Insufficient permissions', requestId },
            { status: 403 }
          )
        )
      }

      return addSecurityHeaders(
        NextResponse.redirect(new URL('/dashboard', request.url))
      )
    }
  }

  // Add security headers and request ID to response
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
