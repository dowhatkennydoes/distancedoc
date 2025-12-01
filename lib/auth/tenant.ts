/**
 * Tenant Isolation Utilities
 * 
 * Comprehensive tenant isolation enforcement for multi-clinic HIPAA compliance.
 * 
 * Features:
 * - Clinic ID validation
 * - Automatic query scoping
 * - Resource access verification
 * - Audit logging for all tenant violations
 */

import { Prisma } from '@prisma/client'
import type { AuthUser, UserSession } from './types'
import { logAudit, logError } from '@/lib/security/logging'
import type { GuardContext } from './guards'

/**
 * Enforce tenant isolation - verify resource belongs to user's clinic
 * 
 * This is the primary tenant isolation check that must be called
 * before accessing any PHI or clinic-scoped resource.
 * 
 * @param resourceClinicId - The clinicId of the resource being accessed
 * @param userClinicId - The clinicId of the authenticated user
 * @param context - Optional guard context for audit logging
 * @throws 403 if clinic mismatch detected
 */
export function enforceTenant(
  resourceClinicId: string | null | undefined,
  userClinicId: string,
  context?: GuardContext
): void {
  if (!resourceClinicId) {
    logAudit(
      'TENANT_ISOLATION_VIOLATION',
      'system',
      'unknown',
      'unknown',
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        reason: 'Resource has no clinicId assigned',
        userClinicId,
      }
    )
    const error: Error & { statusCode?: number } = new Error('Resource clinic not found')
    error.statusCode = 404
    throw error
  }

  if (resourceClinicId !== userClinicId) {
    logAudit(
      'TENANT_ISOLATION_VIOLATION',
      'system',
      resourceClinicId,
      'unknown',
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        reason: 'Clinic mismatch - cross-clinic access attempted',
        userClinicId,
        resourceClinicId,
        severity: 'HIGH',
      }
    )
    const error: Error & { statusCode?: number } = new Error(
      'Forbidden: Access denied. Cross-clinic data access is not permitted.'
    )
    error.statusCode = 403
    throw error
  }
}

/**
 * Enforce tenant isolation with user session
 * Convenience wrapper that extracts clinicId from user
 */
export function enforceTenantWithUser(
  resourceClinicId: string | null | undefined,
  user: AuthUser | UserSession,
  context?: GuardContext
): void {
  enforceTenant(resourceClinicId, user.clinicId, context)
}

/**
 * Create a clinic-scoped where clause for Prisma queries
 * 
 * This ensures all database queries automatically filter by clinicId,
 * preventing accidental cross-clinic data access.
 * 
 * Usage:
 * ```typescript
 * const appointments = await prisma.appointment.findMany({
 *   where: withTenantScope(user.clinicId, { status: 'SCHEDULED' }),
 * })
 * ```
 */
export function withTenantScope<T extends Prisma.WhereInput>(
  userClinicId: string,
  where?: T
): T & { clinicId: string } {
  return {
    ...where,
    clinicId: userClinicId,
  } as T & { clinicId: string }
}

/**
 * Enforce tenant isolation on a resource before access
 * Fetches resource and verifies clinic match
 * 
 * @param getResource - Function that fetches the resource with clinicId
 * @param user - Authenticated user session
 * @param resourceType - Type of resource for logging
 * @param context - Guard context
 * @returns The resource if access is granted
 * @throws 403 or 404 if access denied
 */
export async function enforceTenantOnResource<T extends { clinicId: string }>(
  getResource: () => Promise<T | null>,
  user: AuthUser | UserSession,
  resourceType: string,
  context?: GuardContext
): Promise<T> {
  const resource = await getResource()

  if (!resource) {
    logAudit(
      'TENANT_ISOLATION_VIOLATION',
      resourceType,
      'unknown',
      user.id,
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        reason: 'Resource not found',
        userClinicId: user.clinicId,
      }
    )
    const error: Error & { statusCode?: number } = new Error(`${resourceType} not found`)
    error.statusCode = 404
    throw error
  }

  enforceTenant(resource.clinicId, user.clinicId, context)

  return resource
}

/**
 * Verify that all resources in a list belong to the user's clinic
 * Useful for batch operations
 */
export function enforceTenantOnResources<T extends { clinicId: string }>(
  resources: T[],
  userClinicId: string,
  resourceType: string,
  context?: GuardContext
): void {
  for (const resource of resources) {
    try {
      enforceTenant(resource.clinicId, userClinicId, context)
    } catch (error) {
      logError(
        `Tenant isolation violation in batch: ${resourceType}`,
        error as Error,
        { resourceId: (resource as any).id, userClinicId, resourceClinicId: resource.clinicId },
        undefined,
        context?.requestId
      )
      throw error
    }
  }
}

/**
 * Create tenant-scoped create data
 * Automatically adds clinicId to create operations
 */
export function withTenantCreateData<T extends Record<string, any>>(
  userClinicId: string,
  data: T
): T & { clinicId: string } {
  return {
    ...data,
    clinicId: userClinicId,
  } as T & { clinicId: string }
}

/**
 * Verify tenant access for nested resources
 * When accessing resources through relationships, ensure clinic isolation
 */
export async function verifyNestedTenantAccess(
  parentResource: { clinicId: string },
  childResourceClinicId: string | null | undefined,
  context?: GuardContext
): Promise<void> {
  // Ensure child resource belongs to same clinic as parent
  if (childResourceClinicId && childResourceClinicId !== parentResource.clinicId) {
    logAudit(
      'TENANT_ISOLATION_VIOLATION',
      'system',
      childResourceClinicId,
      'unknown',
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        reason: 'Nested resource clinic mismatch',
        parentClinicId: parentResource.clinicId,
        childClinicId: childResourceClinicId,
        severity: 'HIGH',
      }
    )
    const error: Error & { statusCode?: number } = new Error(
      'Forbidden: Nested resource belongs to different clinic'
    )
    error.statusCode = 403
    throw error
  }
}

