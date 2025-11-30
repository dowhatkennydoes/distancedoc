/**
 * Role-Based Access Control (RBAC) System
 * 
 * Defines permissions and role mappings for DistanceDoc
 * Supports granular permission checking for clinic-level security
 */

import type { UserRole } from './types'

/**
 * Permission definitions
 * Each permission represents a specific action or resource access
 */
export const PERMISSIONS = {
  // Appointment permissions
  APPOINTMENTS_VIEW: 'appointments:view',
  APPOINTMENTS_CREATE: 'appointments:create',
  APPOINTMENTS_UPDATE: 'appointments:update',
  APPOINTMENTS_DELETE: 'appointments:delete',
  APPOINTMENTS_MANAGE: 'appointments:manage', // Full CRUD

  // Visit notes permissions
  NOTES_VIEW: 'notes:view',
  NOTES_CREATE: 'notes:create',
  NOTES_UPDATE: 'notes:update',
  NOTES_DELETE: 'notes:delete',
  NOTES_APPROVE: 'notes:approve',
  NOTES_MANAGE: 'notes:manage', // Full CRUD

  // Prescription permissions
  PRESCRIPTIONS_VIEW: 'prescriptions:view',
  PRESCRIPTIONS_CREATE: 'prescriptions:create',
  PRESCRIPTIONS_UPDATE: 'prescriptions:update',
  PRESCRIPTIONS_DELETE: 'prescriptions:delete',
  PRESCRIPTIONS_MANAGE: 'prescriptions:manage', // Full CRUD

  // Lab orders permissions
  LABS_VIEW: 'labs:view',
  LABS_CREATE: 'labs:create',
  LABS_UPDATE: 'labs:update',
  LABS_DELETE: 'labs:delete',
  LABS_MANAGE: 'labs:manage', // Full CRUD

  // Messages permissions
  MESSAGES_VIEW: 'messages:view',
  MESSAGES_SEND: 'messages:send',
  MESSAGES_DELETE: 'messages:delete',
  MESSAGES_MANAGE: 'messages:manage', // Full CRUD

  // Patient permissions
  PATIENTS_VIEW: 'patients:view',
  PATIENTS_CREATE: 'patients:create',
  PATIENTS_UPDATE: 'patients:update',
  PATIENTS_DELETE: 'patients:delete',
  PATIENTS_MANAGE: 'patients:manage', // Full CRUD

  // File permissions
  FILES_VIEW: 'files:view',
  FILES_UPLOAD: 'files:upload',
  FILES_DELETE: 'files:delete',
  FILES_MANAGE: 'files:manage', // Full CRUD

  // Intake form permissions
  FORMS_VIEW: 'forms:view',
  FORMS_CREATE: 'forms:create',
  FORMS_UPDATE: 'forms:update',
  FORMS_DELETE: 'forms:delete',
  FORMS_SUBMIT: 'forms:submit',
  FORMS_MANAGE: 'forms:manage', // Full CRUD

  // Billing permissions
  BILLING_VIEW: 'billing:view',
  BILLING_CREATE: 'billing:create',
  BILLING_UPDATE: 'billing:update',
  BILLING_REFUND: 'billing:refund',
  BILLING_MANAGE: 'billing:manage', // Full CRUD

  // Consultation permissions
  CONSULTATIONS_VIEW: 'consultations:view',
  CONSULTATIONS_CREATE: 'consultations:create',
  CONSULTATIONS_UPDATE: 'consultations:update',
  CONSULTATIONS_END: 'consultations:end',
  CONSULTATIONS_MANAGE: 'consultations:manage', // Full CRUD

  // Video call permissions
  VIDEO_JOIN: 'video:join',
  VIDEO_MODERATE: 'video:moderate',
  VIDEO_RECORD: 'video:record',

  // Admin permissions
  ADMIN_AUDIT_LOGS: 'admin:audit_logs',
  ADMIN_APPROVE_DOCTORS: 'admin:approve_doctors',
  ADMIN_MANAGE_USERS: 'admin:manage_users',
  ADMIN_SYSTEM_SETTINGS: 'admin:system_settings',
  ADMIN_FULL_ACCESS: 'admin:full_access', // All admin permissions

  // Support permissions (read-only)
  SUPPORT_VIEW_APPOINTMENTS: 'support:view_appointments',
  SUPPORT_VIEW_MESSAGES: 'support:view_messages',
  SUPPORT_VIEW_PATIENTS: 'support:view_patients',
  SUPPORT_VIEW_BILLING: 'support:view_billing',
  SUPPORT_VIEW_LOGS: 'support:view_logs',
} as const

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS]

/**
 * Role to permissions mapping
 * Defines what permissions each role has
 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  doctor: [
    // Appointments - full management
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_UPDATE,
    PERMISSIONS.APPOINTMENTS_DELETE,
    PERMISSIONS.APPOINTMENTS_MANAGE,

    // Visit notes - full management
    PERMISSIONS.NOTES_VIEW,
    PERMISSIONS.NOTES_CREATE,
    PERMISSIONS.NOTES_UPDATE,
    PERMISSIONS.NOTES_APPROVE,
    PERMISSIONS.NOTES_MANAGE,

    // Prescriptions - full management
    PERMISSIONS.PRESCRIPTIONS_VIEW,
    PERMISSIONS.PRESCRIPTIONS_CREATE,
    PERMISSIONS.PRESCRIPTIONS_UPDATE,
    PERMISSIONS.PRESCRIPTIONS_DELETE,
    PERMISSIONS.PRESCRIPTIONS_MANAGE,

    // Lab orders - full management
    PERMISSIONS.LABS_VIEW,
    PERMISSIONS.LABS_CREATE,
    PERMISSIONS.LABS_UPDATE,
    PERMISSIONS.LABS_DELETE,
    PERMISSIONS.LABS_MANAGE,

    // Messages - full management
    PERMISSIONS.MESSAGES_VIEW,
    PERMISSIONS.MESSAGES_SEND,
    PERMISSIONS.MESSAGES_DELETE,
    PERMISSIONS.MESSAGES_MANAGE,

    // Patients - view and update (for their patients)
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.PATIENTS_UPDATE,

    // Files - view and upload
    PERMISSIONS.FILES_VIEW,
    PERMISSIONS.FILES_UPLOAD,

    // Intake forms - view and manage
    PERMISSIONS.FORMS_VIEW,
    PERMISSIONS.FORMS_CREATE,
    PERMISSIONS.FORMS_UPDATE,
    PERMISSIONS.FORMS_DELETE,
    PERMISSIONS.FORMS_MANAGE,

    // Billing - view and manage
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_MANAGE,

    // Consultations - full management
    PERMISSIONS.CONSULTATIONS_VIEW,
    PERMISSIONS.CONSULTATIONS_CREATE,
    PERMISSIONS.CONSULTATIONS_UPDATE,
    PERMISSIONS.CONSULTATIONS_END,
    PERMISSIONS.CONSULTATIONS_MANAGE,

    // Video calls
    PERMISSIONS.VIDEO_JOIN,
    PERMISSIONS.VIDEO_MODERATE,
    PERMISSIONS.VIDEO_RECORD,
  ],

  patient: [
    // Appointments - view own, create, update own
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.APPOINTMENTS_CREATE,
    PERMISSIONS.APPOINTMENTS_UPDATE, // Only own appointments

    // Visit notes - view own
    PERMISSIONS.NOTES_VIEW, // Only own notes

    // Prescriptions - view own
    PERMISSIONS.PRESCRIPTIONS_VIEW, // Only own prescriptions

    // Lab orders - view own
    PERMISSIONS.LABS_VIEW, // Only own labs

    // Messages - view and send
    PERMISSIONS.MESSAGES_VIEW,
    PERMISSIONS.MESSAGES_SEND,

    // Patients - view own profile only
    PERMISSIONS.PATIENTS_VIEW, // Only own profile
    PERMISSIONS.PATIENTS_UPDATE, // Only own profile

    // Files - view own, upload
    PERMISSIONS.FILES_VIEW, // Only own files
    PERMISSIONS.FILES_UPLOAD,

    // Intake forms - view and submit
    PERMISSIONS.FORMS_VIEW,
    PERMISSIONS.FORMS_SUBMIT,

    // Billing - view own
    PERMISSIONS.BILLING_VIEW, // Only own billing

    // Consultations - view own, join
    PERMISSIONS.CONSULTATIONS_VIEW, // Only own consultations
    PERMISSIONS.VIDEO_JOIN,
  ],

  admin: [
    // All doctor permissions
    ...ROLE_PERMISSIONS.doctor,

    // Admin-specific permissions
    PERMISSIONS.ADMIN_AUDIT_LOGS,
    PERMISSIONS.ADMIN_APPROVE_DOCTORS,
    PERMISSIONS.ADMIN_MANAGE_USERS,
    PERMISSIONS.ADMIN_SYSTEM_SETTINGS,
    PERMISSIONS.ADMIN_FULL_ACCESS,

    // Additional permissions
    PERMISSIONS.PATIENTS_MANAGE, // Can manage all patients
    PERMISSIONS.FILES_MANAGE, // Can manage all files
    PERMISSIONS.BILLING_MANAGE, // Can manage all billing
  ],

  support: [
    // Read-only access to selected scopes
    PERMISSIONS.SUPPORT_VIEW_APPOINTMENTS,
    PERMISSIONS.SUPPORT_VIEW_MESSAGES,
    PERMISSIONS.SUPPORT_VIEW_PATIENTS,
    PERMISSIONS.SUPPORT_VIEW_BILLING,
    PERMISSIONS.SUPPORT_VIEW_LOGS,

    // Basic view permissions (for context)
    PERMISSIONS.APPOINTMENTS_VIEW,
    PERMISSIONS.MESSAGES_VIEW,
    PERMISSIONS.PATIENTS_VIEW,
    PERMISSIONS.BILLING_VIEW,
  ],
} as const

/**
 * Check if a user role has a specific permission
 * 
 * @param userRole - The user's role
 * @param permission - The permission to check
 * @returns true if the role has the permission, false otherwise
 * 
 * @example
 * ```typescript
 * canAccess('doctor', PERMISSIONS.APPOINTMENTS_MANAGE) // true
 * canAccess('patient', PERMISSIONS.APPOINTMENTS_MANAGE) // false
 * ```
 */
export function canAccess(userRole: UserRole, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || []
  
  // Check if role has the specific permission
  if (rolePermissions.includes(permission)) {
    return true
  }

  // Check for wildcard permissions (e.g., APPOINTMENTS_MANAGE includes all appointment permissions)
  // This allows checking for granular permissions when a role has the "manage" permission
  if (permission.includes(':')) {
    const [resource, action] = permission.split(':')
    const managePermission = `${resource}:manage` as Permission
    
    if (rolePermissions.includes(managePermission)) {
      return true
    }

    // Check if admin has full access
    if (userRole === 'admin' && rolePermissions.includes(PERMISSIONS.ADMIN_FULL_ACCESS)) {
      return true
    }
  }

  return false
}

/**
 * Check if a user role has any of the specified permissions
 * 
 * @param userRole - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has at least one of the permissions
 */
export function canAccessAny(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => canAccess(userRole, permission))
}

/**
 * Check if a user role has all of the specified permissions
 * 
 * @param userRole - The user's role
 * @param permissions - Array of permissions to check
 * @returns true if the role has all of the permissions
 */
export function canAccessAll(userRole: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => canAccess(userRole, permission))
}

/**
 * Get all permissions for a role
 * 
 * @param userRole - The user's role
 * @returns Array of permissions for the role
 */
export function getRolePermissions(userRole: UserRole): Permission[] {
  return ROLE_PERMISSIONS[userRole] || []
}

/**
 * Check if permission requires resource ownership
 * Some permissions are only valid for resources owned by the user
 * 
 * @param permission - The permission to check
 * @returns true if the permission requires resource ownership
 */
export function requiresOwnership(permission: Permission): boolean {
  // Patient permissions typically require ownership
  const ownershipRequiredPermissions: Permission[] = [
    PERMISSIONS.APPOINTMENTS_UPDATE, // Patients can only update their own
    PERMISSIONS.NOTES_VIEW, // Patients can only view their own
    PERMISSIONS.PRESCRIPTIONS_VIEW, // Patients can only view their own
    PERMISSIONS.LABS_VIEW, // Patients can only view their own
    PERMISSIONS.PATIENTS_VIEW, // Patients can only view their own
    PERMISSIONS.PATIENTS_UPDATE, // Patients can only update their own
    PERMISSIONS.FILES_VIEW, // Patients can only view their own
    PERMISSIONS.BILLING_VIEW, // Patients can only view their own
    PERMISSIONS.CONSULTATIONS_VIEW, // Patients can only view their own
  ]

  return ownershipRequiredPermissions.includes(permission)
}

/**
 * Route to permission mapping
 * Maps API routes and page routes to required permissions
 */
export const ROUTE_PERMISSIONS: Record<string, Permission | Permission[]> = {
  // Appointment routes
  '/api/appointments': PERMISSIONS.APPOINTMENTS_VIEW,
  '/api/appointments/patient': PERMISSIONS.APPOINTMENTS_VIEW,
  'POST:/api/appointments': PERMISSIONS.APPOINTMENTS_CREATE,
  'PUT:/api/appointments': PERMISSIONS.APPOINTMENTS_UPDATE,
  'DELETE:/api/appointments': PERMISSIONS.APPOINTMENTS_DELETE,

  // Visit notes routes
  '/api/visit-notes': PERMISSIONS.NOTES_VIEW,
  '/api/visit-notes/patient': PERMISSIONS.NOTES_VIEW,
  'POST:/api/visit-notes': PERMISSIONS.NOTES_CREATE,
  'PUT:/api/visit-notes': PERMISSIONS.NOTES_UPDATE,
  'DELETE:/api/visit-notes': PERMISSIONS.NOTES_DELETE,

  // Prescription routes
  '/api/prescriptions': PERMISSIONS.PRESCRIPTIONS_VIEW,
  'POST:/api/prescriptions': PERMISSIONS.PRESCRIPTIONS_CREATE,
  'PUT:/api/prescriptions': PERMISSIONS.PRESCRIPTIONS_UPDATE,
  'DELETE:/api/prescriptions': PERMISSIONS.PRESCRIPTIONS_DELETE,

  // Lab routes
  '/api/labs': PERMISSIONS.LABS_VIEW,
  'POST:/api/labs': PERMISSIONS.LABS_CREATE,
  'PUT:/api/labs': PERMISSIONS.LABS_UPDATE,
  'DELETE:/api/labs': PERMISSIONS.LABS_DELETE,

  // Message routes
  '/api/messages': PERMISSIONS.MESSAGES_VIEW,
  'POST:/api/messages': PERMISSIONS.MESSAGES_SEND,
  'DELETE:/api/messages': PERMISSIONS.MESSAGES_DELETE,

  // Patient routes
  '/api/patient': PERMISSIONS.PATIENTS_VIEW,
  '/api/patients': PERMISSIONS.PATIENTS_VIEW,
  'POST:/api/patients': PERMISSIONS.PATIENTS_CREATE,
  'PUT:/api/patients': PERMISSIONS.PATIENTS_UPDATE,
  'DELETE:/api/patients': PERMISSIONS.PATIENTS_DELETE,

  // File routes
  '/api/files': PERMISSIONS.FILES_VIEW,
  '/api/files/upload-url': PERMISSIONS.FILES_UPLOAD,
  'DELETE:/api/files': PERMISSIONS.FILES_DELETE,

  // Form routes
  '/api/forms': PERMISSIONS.FORMS_VIEW,
  'POST:/api/forms': PERMISSIONS.FORMS_CREATE,
  'PUT:/api/forms': PERMISSIONS.FORMS_UPDATE,
  'DELETE:/api/forms': PERMISSIONS.FORMS_DELETE,
  'POST:/api/forms/submit': PERMISSIONS.FORMS_SUBMIT,

  // Billing routes
  '/api/billing': PERMISSIONS.BILLING_VIEW,
  '/api/payments': PERMISSIONS.BILLING_VIEW,
  '/api/payments/patient': PERMISSIONS.BILLING_VIEW,
  'POST:/api/payments': PERMISSIONS.BILLING_CREATE,
  'PUT:/api/payments': PERMISSIONS.BILLING_UPDATE,

  // Consultation routes
  '/api/consultations': PERMISSIONS.CONSULTATIONS_VIEW,
  'POST:/api/consultations': PERMISSIONS.CONSULTATIONS_CREATE,
  'PUT:/api/consultations': PERMISSIONS.CONSULTATIONS_UPDATE,

  // Video routes
  '/api/video': PERMISSIONS.VIDEO_JOIN,

  // Admin routes
  '/api/admin/audit-logs': PERMISSIONS.ADMIN_AUDIT_LOGS,
  '/api/auth/approve-doctor': PERMISSIONS.ADMIN_APPROVE_DOCTORS,
  '/api/admin/users': PERMISSIONS.ADMIN_MANAGE_USERS,
  '/api/admin/settings': PERMISSIONS.ADMIN_SYSTEM_SETTINGS,

  // Page routes
  '/doctor/appointments': PERMISSIONS.APPOINTMENTS_VIEW,
  '/doctor/patients': PERMISSIONS.PATIENTS_VIEW,
  '/doctor/visit-notes': PERMISSIONS.NOTES_VIEW,
  '/doctor/billing': PERMISSIONS.BILLING_VIEW,
  '/patient/visits': PERMISSIONS.APPOINTMENTS_VIEW,
  '/patient/files': PERMISSIONS.FILES_VIEW,
  '/patient/messages': PERMISSIONS.MESSAGES_VIEW,
  '/patient/payments': PERMISSIONS.BILLING_VIEW,
  '/admin': PERMISSIONS.ADMIN_FULL_ACCESS,
} as const

/**
 * Get required permission for a route
 * 
 * @param method - HTTP method (GET, POST, etc.) or undefined for GET
 * @param pathname - Route pathname
 * @returns Permission or array of permissions required, or null if no permission required
 */
export function getRoutePermission(
  method: string = 'GET',
  pathname: string
): Permission | Permission[] | null {
  // Try method-specific route first
  const methodRoute = `${method}:${pathname}`
  if (ROUTE_PERMISSIONS[methodRoute]) {
    return ROUTE_PERMISSIONS[methodRoute]
  }

  // Try pathname only
  if (ROUTE_PERMISSIONS[pathname]) {
    return ROUTE_PERMISSIONS[pathname]
  }

  // Try prefix matching
  for (const [route, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route.replace(/^(GET|POST|PUT|DELETE|PATCH):/, ''))) {
      return permission
    }
  }

  return null
}

