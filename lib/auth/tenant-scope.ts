/**
 * Tenant Isolation Utilities
 * 
 * Provides clinic scoping for all database queries to ensure
 * multi-tenant data isolation
 */

import { Prisma } from '@prisma/client'
import type { UserSession } from './guards'
import { logError, logAudit } from '@/lib/security/logging'

/**
 * Verify that a resource belongs to the user's clinic
 * Throws 403 if clinic mismatch
 */
export function verifyClinicAccess(
  resourceClinicId: string | null | undefined,
  userClinicId: string,
  resourceType: string,
  resourceId: string,
  requestId?: string
): void {
  if (!resourceClinicId) {
    logAudit(
      'CLINIC_ACCESS_DENIED',
      resourceType,
      resourceId,
      undefined,
      false,
      {
        requestId,
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
      'CLINIC_ACCESS_DENIED',
      resourceType,
      resourceId,
      undefined,
      false,
      {
        requestId,
        reason: 'Clinic mismatch',
        userClinicId,
        resourceClinicId,
      }
    )
    const error: Error & { statusCode?: number } = new Error('Forbidden: Access denied to this clinic\'s data')
    error.statusCode = 403
    throw error
  }
}

/**
 * Create a clinic-scoped where clause for Prisma queries
 */
export function withClinicScope<T extends Prisma.WhereInput>(
  userClinicId: string,
  where?: T
): T & { clinicId: string } {
  return {
    ...where,
    clinicId: userClinicId,
  } as T & { clinicId: string }
}

/**
 * Verify clinic access for a doctor record
 */
export async function verifyDoctorClinicAccess(
  doctorId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
): Promise<void> {
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: { clinicId: true },
  })

  if (!doctor) {
    const error: Error & { statusCode?: number } = new Error('Doctor not found')
    error.statusCode = 404
    throw error
  }

  verifyClinicAccess(doctor.clinicId, userClinicId, 'doctor', doctorId, requestId)
}

/**
 * Verify clinic access for a patient record
 */
export async function verifyPatientClinicAccess(
  patientId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
): Promise<void> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { clinicId: true },
  })

  if (!patient) {
    const error: Error & { statusCode?: number } = new Error('Patient not found')
    error.statusCode = 404
    throw error
  }

  verifyClinicAccess(patient.clinicId, userClinicId, 'patient', patientId, requestId)
}

/**
 * Verify clinic access for an appointment record
 */
export async function verifyAppointmentClinicAccess(
  appointmentId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { clinicId: true },
  })

  if (!appointment) {
    const error: Error & { statusCode?: number } = new Error('Appointment not found')
    error.statusCode = 404
    throw error
  }

  verifyClinicAccess(appointment.clinicId, userClinicId, 'appointment', appointmentId, requestId)
}

/**
 * Verify clinic access for a visit note record
 */
export async function verifyVisitNoteClinicAccess(
  visitNoteId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
): Promise<void> {
  const visitNote = await prisma.visitNote.findUnique({
    where: { id: visitNoteId },
    select: { clinicId: true },
  })

  if (!visitNote) {
    const error: Error & { statusCode?: number } = new Error('Visit note not found')
    error.statusCode = 404
    throw error
  }

  verifyClinicAccess(visitNote.clinicId, userClinicId, 'visitNote', visitNoteId, requestId)
}

/**
 * Verify clinic access for a message thread record
 */
export async function verifyMessageThreadClinicAccess(
  threadId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
): Promise<void> {
  const thread = await prisma.messageThread.findUnique({
    where: { id: threadId },
    select: { clinicId: true },
  })

  if (!thread) {
    const error: Error & { statusCode?: number } = new Error('Message thread not found')
    error.statusCode = 404
    throw error
  }

  verifyClinicAccess(thread.clinicId, userClinicId, 'messageThread', threadId, requestId)
}

/**
 * Get clinic-scoped doctor record
 * Throws if doctor not found or clinic mismatch
 */
export async function getDoctorWithClinicScope(
  doctorId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
) {
  await verifyDoctorClinicAccess(doctorId, userClinicId, prisma, requestId)
  
  return await prisma.doctor.findUnique({
    where: { id: doctorId, clinicId: userClinicId },
  })
}

/**
 * Get clinic-scoped patient record
 * Throws if patient not found or clinic mismatch
 */
export async function getPatientWithClinicScope(
  patientId: string,
  userClinicId: string,
  prisma: any,
  requestId?: string
) {
  await verifyPatientClinicAccess(patientId, userClinicId, prisma, requestId)
  
  return await prisma.patient.findUnique({
    where: { id: patientId, clinicId: userClinicId },
  })
}

/**
 * Require clinic match - helper for middleware
 */
export function requireClinicMatch(
  userClinicId: string,
  resourceClinicId: string | null | undefined,
  resourceType: string,
  resourceId: string,
  requestId?: string
): void {
  verifyClinicAccess(resourceClinicId, userClinicId, resourceType, resourceId, requestId)
}

