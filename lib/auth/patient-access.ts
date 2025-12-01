/**
 * Doctor-to-Patient Access Control
 * 
 * Comprehensive RBAC guards for doctor-to-patient access, ensuring
 * HIPAA compliance through proper relationship validation and clinic isolation.
 * 
 * Features:
 * - Doctor role verification
 * - Clinic ID matching validation
 * - Relationship verification (appointments, consultations, explicit relationships)
 * - Ownership or doctor access checks
 * - Comprehensive audit logging
 */

import type { UserSession, AuthUser } from './types'
import { prisma } from '@/db/prisma'
import { logAudit, logError } from '@/lib/security/logging'
import type { GuardContext } from './guards'

/**
 * Verify that a patient belongs to the specified clinic
 * Throws 403 if clinic mismatch or patient not found
 */
export async function ensurePatientBelongsToDoctorClinic(
  patientId: string,
  clinicId: string,
  context?: GuardContext
): Promise<void> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        clinicId: true,
      },
    })

    if (!patient) {
      logAudit(
        'PATIENT_NOT_FOUND',
        'patient',
        patientId,
        undefined,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          clinicId,
        }
      )

      const error: Error & { statusCode?: number } = new Error('Patient not found')
      error.statusCode = 404
      throw error
    }

    if (patient.clinicId !== clinicId) {
      logAudit(
        'CLINIC_MISMATCH',
        'patient',
        patientId,
        undefined,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          patientClinicId: patient.clinicId,
          requestedClinicId: clinicId,
          reason: 'Patient belongs to different clinic',
        }
      )

      const error: Error & { statusCode?: number } = new Error('Forbidden: Patient does not belong to your clinic')
      error.statusCode = 403
      throw error
    }
  } catch (error: any) {
    // Re-throw if it's already our custom error
    if (error.statusCode) {
      throw error
    }

    logError(
      'Failed to verify patient clinic membership',
      error as Error,
      { patientId, clinicId },
      undefined,
      context?.requestId
    )

    const newError: Error & { statusCode?: number } = new Error('Failed to verify patient clinic access')
    newError.statusCode = 500
    throw newError
  }
}

/**
 * Check if a doctor has a relationship with a patient through:
 * - Appointments
 * - Consultations
 * - Lab orders
 * - Visit notes
 * - Message threads
 * 
 * Returns true if any relationship exists
 */
async function hasDoctorPatientRelationship(
  doctorId: string,
  patientId: string
): Promise<boolean> {
  // Check for appointments (most common relationship)
  const hasAppointment = await prisma.appointment.findFirst({
    where: {
      doctorId,
      patientId,
    },
    select: { id: true },
  })

  if (hasAppointment) {
    return true
  }

  // Check for consultations
  const hasConsultation = await prisma.consultation.findFirst({
    where: {
      doctorId,
      patientId,
    },
    select: { id: true },
  })

  if (hasConsultation) {
    return true
  }

  // Check for lab orders
  const hasLabOrder = await prisma.labOrder.findFirst({
    where: {
      doctorId,
      patientId,
    },
    select: { id: true },
  })

  if (hasLabOrder) {
    return true
  }

  // Check for visit notes
  const hasVisitNote = await prisma.visitNote.findFirst({
    where: {
      doctorId,
      patientId,
    },
    select: { id: true },
  })

  if (hasVisitNote) {
    return true
  }

  // Check for message threads
  const hasMessageThread = await prisma.messageThread.findFirst({
    where: {
      doctorId,
      patientId,
    },
    select: { id: true },
  })

  if (hasMessageThread) {
    return true
  }

  return false
}

/**
 * Comprehensive doctor-to-patient access check
 * 
 * Validates:
 * 1. User role is "doctor"
 * 2. Doctor's clinicId matches patient's clinicId
 * 3. Doctor has a relationship with patient via appointments, consultations, or other clinical interactions
 * 
 * Throws 403 if any validation fails
 */
export async function requireDoctorAccessToPatient(
  user: UserSession | AuthUser,
  patientId: string,
  context?: GuardContext
): Promise<void> {
  try {
    // 1. Verify user role is "doctor"
    if (user.role !== 'doctor') {
      logAudit(
        'DOCTOR_ROLE_REQUIRED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userRole: user.role,
          patientId,
          reason: 'User role is not doctor',
        }
      )

      const error: Error & { statusCode?: number } = new Error('Forbidden: Doctor role required')
      error.statusCode = 403
      throw error
    }

    // 2. Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        clinicId: true,
      },
    })

    if (!doctor) {
      logAudit(
        'DOCTOR_NOT_FOUND',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          patientId,
          reason: 'Doctor profile not found',
        }
      )

      const error: Error & { statusCode?: number } = new Error('Doctor profile not found')
      error.statusCode = 404
      throw error
    }

    // 3. Verify clinic ID matches
    await ensurePatientBelongsToDoctorClinic(patientId, doctor.clinicId, context)

    // 4. Verify doctor has a relationship with patient
    const hasRelationship = await hasDoctorPatientRelationship(doctor.id, patientId)

    if (!hasRelationship) {
      logAudit(
        'DOCTOR_PATIENT_RELATIONSHIP_NOT_FOUND',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          doctorId: doctor.id,
          patientId,
          clinicId: doctor.clinicId,
          reason: 'Doctor has no relationship with patient (no appointments, consultations, lab orders, visit notes, or messages)',
        }
      )

      const error: Error & { statusCode?: number } = new Error(
        'Forbidden: You do not have an established clinical relationship with this patient. ' +
        'Access requires an appointment, consultation, lab order, visit note, or message thread.'
      )
      error.statusCode = 403
      throw error
    }

    // Success - log access granted
    logAudit(
      'DOCTOR_PATIENT_ACCESS_GRANTED',
      'user',
      user.id,
      user.id,
      true,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        doctorId: doctor.id,
        patientId,
        clinicId: doctor.clinicId,
      }
    )
  } catch (error: any) {
    // Re-throw if it's already our custom error
    if (error.statusCode) {
      throw error
    }

    logError(
      'Failed to verify doctor-to-patient access',
      error as Error,
      { userId: user.id, patientId, userRole: user.role },
      user.id,
      context?.requestId
    )

    const newError: Error & { statusCode?: number } = new Error('Failed to verify doctor-to-patient access')
    newError.statusCode = 500
    throw newError
  }
}

/**
 * Ensure either ownership (patient accessing their own data) OR doctor access
 * 
 * This is useful for resources that can be accessed by:
 * - The patient themselves (ownership)
 * - A doctor with proper relationship (doctor access)
 * 
 * Throws 403 if neither condition is met
 */
export async function ensureOwnershipOrDoctor(
  user: UserSession | AuthUser,
  patientId: string,
  context?: GuardContext
): Promise<void> {
  try {
    // Check if user is the patient themselves (ownership)
    if (user.role === 'patient') {
      const patient = await prisma.patient.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          clinicId: true,
        },
      })

      if (!patient) {
        const error: Error & { statusCode?: number } = new Error('Patient profile not found')
        error.statusCode = 404
        throw error
      }

      // Verify clinic match
      if (patient.clinicId !== user.clinicId) {
        const error: Error & { statusCode?: number } = new Error('Forbidden: Clinic mismatch')
        error.statusCode = 403
        throw error
      }

      // Check ownership
      if (patient.id === patientId) {
        // Ownership confirmed - log and return
        logAudit(
          'PATIENT_OWNERSHIP_VERIFIED',
          'user',
          user.id,
          user.id,
          true,
          {
            requestId: context?.requestId,
            pathname: context?.pathname,
            patientId,
            clinicId: patient.clinicId,
          }
        )
        return
      }

      // Patient trying to access another patient's data - denied
      logAudit(
        'OWNERSHIP_DENIED',
        'user',
        user.id,
        user.id,
        false,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          userPatientId: patient.id,
          requestedPatientId: patientId,
          reason: 'Patient cannot access another patient\'s data',
        }
      )

      const error: Error & { statusCode?: number } = new Error('Forbidden: You can only access your own data')
      error.statusCode = 403
      throw error
    }

    // Check if user is a doctor with proper access
    if (user.role === 'doctor') {
      await requireDoctorAccessToPatient(user, patientId, context)
      return
    }

    // Admin can access all resources
    if (user.role === 'admin') {
      logAudit(
        'ADMIN_ACCESS_GRANTED',
        'user',
        user.id,
        user.id,
        true,
        {
          requestId: context?.requestId,
          pathname: context?.pathname,
          patientId,
        }
      )
      return
    }

    // Default: access denied
    logAudit(
      'ACCESS_DENIED_NO_OWNERSHIP_OR_DOCTOR',
      'user',
      user.id,
      user.id,
      false,
      {
        requestId: context?.requestId,
        pathname: context?.pathname,
        userRole: user.role,
        patientId,
        reason: 'User is neither the patient owner nor a doctor with access',
      }
    )

    const error: Error & { statusCode?: number } = new Error('Forbidden: Access denied')
    error.statusCode = 403
    throw error
  } catch (error: any) {
    // Re-throw if it's already our custom error
    if (error.statusCode) {
      throw error
    }

    logError(
      'Failed to verify ownership or doctor access',
      error as Error,
      { userId: user.id, patientId, userRole: user.role },
      user.id,
      context?.requestId
    )

    const newError: Error & { statusCode?: number } = new Error('Failed to verify access')
    newError.statusCode = 500
    throw newError
  }
}

/**
 * Get patient with doctor access validation
 * Throws if doctor doesn't have access
 */
export async function getPatientWithDoctorAccess(
  user: UserSession | AuthUser,
  patientId: string,
  context?: GuardContext
) {
  // Verify access first
  await requireDoctorAccessToPatient(user, patientId, context)

  // Get doctor to verify clinic
  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { clinicId: true },
  })

  if (!doctor) {
    const error: Error & { statusCode?: number } = new Error('Doctor profile not found')
    error.statusCode = 404
    throw error
  }

  // Fetch patient with clinic scope
  const patient = await prisma.patient.findUnique({
    where: {
      id: patientId,
      clinicId: doctor.clinicId,
    },
  })

  if (!patient) {
    const error: Error & { statusCode?: number } = new Error('Patient not found')
    error.statusCode = 404
    throw error
  }

  return patient
}

