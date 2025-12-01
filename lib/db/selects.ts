/**
 * Prisma Safe Select Helpers
 * 
 * These helpers restrict what fields can be returned to the frontend
 * depending on user role, preventing over-fetching of PHI and ensuring
 * HIPAA compliance through field-level access control.
 * 
 * Key principles:
 * - Doctors can access full clinical data for their patients
 * - Patients can only access their own data with appropriate fields
 * - Minimal selects for list views to reduce PHI exposure
 * - Never expose: payment methods, audit logs, session tokens, OAuth info
 */

import { Prisma } from '@prisma/client'

// ============================================================================
// PATIENT SELECTS
// ============================================================================

/**
 * Minimal patient select for list views
 * Only includes basic identifying information - no PHI
 */
export const patientSafeSelectMinimal: Prisma.PatientSelect = {
  id: true,
  firstName: true,
  lastName: true,
  dateOfBirth: true,
}

/**
 * Patient select for patient accessing their own data
 * Includes all patient-accessible fields but excludes sensitive doctor-only data
 */
export const patientSafeSelectForPatientSelf: Prisma.PatientSelect = {
  id: true,
  userId: true,
  clinicId: true,
  
  // Basic Demographics
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  genderIdentity: true,
  
  // Contact Information
  phone: true,
  email: true,
  
  // Address
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  
  // Emergency & Pharmacy
  emergencyContact: true,
  preferredPharmacy: true,
  
  // Preferences & Language
  preferredLanguage: true,
  
  // Insurance (patient can view their own insurance)
  insuranceProvider: true,
  insuranceMemberId: true,
  
  // Medical History - Patient can view their own medical history
  allergies: true,
  currentMedicationsData: true,
  pastMedicalHistory: true,
  familyHistory: true,
  
  // Timestamps
  createdAt: true,
  updatedAt: true,
  
  // Relationships - Patient can view their own related data
  appointments: {
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      status: true,
      visitType: true,
      reason: true,
      createdAt: true,
    },
  },
  intakeForms: {
    select: {
      id: true,
      type: true,
      status: true,
      submittedAt: true,
      createdAt: true,
    },
  },
  medications: {
    select: {
      id: true,
      name: true,
      dosage: true,
      frequency: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  },
  labOrders: {
    select: {
      id: true,
      orderNumber: true,
      tests: true,
      status: true,
      orderedAt: true,
      completedAt: true,
    },
  },
  fileRecords: {
    select: {
      id: true,
      fileName: true,
      fileType: true,
      category: true,
      createdAt: true,
    },
  },
  visitNotes: {
    select: {
      id: true,
      createdAt: true,
      signedAt: true,
    },
  },
}

/**
 * Patient select for doctor accessing patient data
 * Includes full clinical information needed for medical care
 * EXCLUDES: payment details, audit logs, session tokens
 */
export const patientSafeSelectForDoctor: Prisma.PatientSelect = {
  id: true,
  userId: true,
  clinicId: true,
  
  // Basic Demographics
  firstName: true,
  lastName: true,
  dateOfBirth: true,
  sex: true,
  genderIdentity: true,
  
  // Contact Information
  phone: true,
  email: true,
  
  // Address
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  
  // Emergency & Pharmacy
  emergencyContact: true,
  preferredPharmacy: true,
  
  // Preferences & Language
  preferredLanguage: true,
  
  // Insurance
  insuranceProvider: true,
  insuranceMemberId: true,
  
  // Medical History - Full clinical access
  allergies: true,
  currentMedicationsData: true,
  pastMedicalHistory: true,
  familyHistory: true,
  
  // Timestamps
  createdAt: true,
  updatedAt: true,
  
  // Clinical Relationships - Full access to patient's clinical data
  appointments: {
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      status: true,
      visitType: true,
      reason: true,
      notes: true,
      meetingUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  consultations: {
    select: {
      id: true,
      status: true,
      startedAt: true,
      endedAt: true,
      transcription: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  visitNotes: {
    select: {
      id: true,
      subjective: true,
      objective: true,
      assessment: true,
      plan: true,
      chiefComplaint: true,
      diagnosis: true,
      procedures: true,
      followUpDate: true,
      signedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  intakeForms: {
    select: {
      id: true,
      type: true,
      status: true,
      formData: true,
      chiefComplaint: true,
      symptoms: true,
      currentMedications: true,
      allergies: true,
      medicalHistory: true,
      familyHistory: true,
      socialHistory: true,
      submittedAt: true,
      reviewedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  medications: {
    select: {
      id: true,
      name: true,
      dosage: true,
      frequency: true,
      route: true,
      startDate: true,
      endDate: true,
      status: true,
      prescribedBy: true,
      instructions: true,
      pharmacy: true,
      refills: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  labOrders: {
    select: {
      id: true,
      orderNumber: true,
      tests: true,
      status: true,
      orderedAt: true,
      completedAt: true,
      results: true,
      resultsUrl: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  fileRecords: {
    select: {
      id: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      storageUrl: true,
      category: true,
      description: true,
      encrypted: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  
  // NOTE: Payments are EXCLUDED - doctors cannot access payment information
  // NOTE: Messages are handled separately through messageThreadSelect
}

// ============================================================================
// APPOINTMENT SELECT
// ============================================================================

export const appointmentSelect: Prisma.AppointmentSelect = {
  id: true,
  doctorId: true,
  patientId: true,
  clinicId: true,
  scheduledAt: true,
  duration: true,
  status: true,
  visitType: true,
  reason: true,
  notes: true,
  meetingUrl: true,
  meetingId: true,
  createdAt: true,
  updatedAt: true,
  cancelledAt: true,
  completedAt: true,
  
  // Related doctor information (minimal)
  doctor: {
    select: {
      id: true,
      specialization: true,
      credentials: true,
    },
  },
  
  // Related patient information (minimal)
  patient: {
    select: patientSafeSelectMinimal,
  },
}

// ============================================================================
// CONSULTATION SELECT WITH SOAP
// ============================================================================

export const consultationSelectWithSoap: Prisma.ConsultationSelect = {
  id: true,
  appointmentId: true,
  doctorId: true,
  patientId: true,
  clinicId: true,
  status: true,
  startedAt: true,
  endedAt: true,
  transcription: true,
  recordingUrl: true,
  createdAt: true,
  updatedAt: true,
  
  // Include related appointment
  appointment: {
    select: {
      id: true,
      scheduledAt: true,
      duration: true,
      status: true,
      visitType: true,
      reason: true,
    },
  },
  
  // Include SOAP note if available
  visitNote: {
    select: {
      id: true,
      subjective: true,
      objective: true,
      assessment: true,
      plan: true,
      chiefComplaint: true,
      diagnosis: true,
      procedures: true,
      followUpDate: true,
      signedAt: true,
      signedBy: true,
      aiGenerated: true,
      aiModel: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  
  // Minimal doctor info
  doctor: {
    select: {
      id: true,
      specialization: true,
      credentials: true,
    },
  },
  
  // Minimal patient info
  patient: {
    select: patientSafeSelectMinimal,
  },
}

// ============================================================================
// FILE RECORD SELECT
// ============================================================================

export const fileRecordSelect: Prisma.FileRecordSelect = {
  id: true,
  patientId: true,
  clinicId: true,
  fileName: true,
  fileType: true,
  fileSize: true,
  storageUrl: true,
  storagePath: true, // Keep for backend operations, frontend shouldn't expose this
  category: true,
  description: true,
  uploadedBy: true,
  encrypted: true,
  createdAt: true,
  updatedAt: true,
  
  // Minimal patient info
  patient: {
    select: patientSafeSelectMinimal,
  },
}

// ============================================================================
// LAB ORDER SELECT
// ============================================================================

export const labOrderSelect: Prisma.LabOrderSelect = {
  id: true,
  patientId: true,
  doctorId: true,
  clinicId: true,
  orderNumber: true,
  tests: true,
  status: true,
  orderedAt: true,
  completedAt: true,
  results: true,
  resultsUrl: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  
  // Minimal patient info
  patient: {
    select: patientSafeSelectMinimal,
  },
  
  // Minimal doctor info
  doctor: {
    select: {
      id: true,
      specialization: true,
      credentials: true,
    },
  },
}

// ============================================================================
// INTAKE FORM RESPONSE SELECT
// ============================================================================

export const intakeFormResponseSelect: Prisma.IntakeFormSelect = {
  id: true,
  patientId: true,
  clinicId: true,
  type: true,
  status: true,
  formData: true,
  chiefComplaint: true,
  symptoms: true,
  currentMedications: true,
  allergies: true,
  medicalHistory: true,
  familyHistory: true,
  socialHistory: true,
  submittedAt: true,
  reviewedAt: true,
  reviewedBy: true,
  createdAt: true,
  updatedAt: true,
  
  // Minimal patient info
  patient: {
    select: patientSafeSelectMinimal,
  },
}

// ============================================================================
// TYPE HELPERS
// ============================================================================

/**
 * Type-safe return types for each select
 */
export type PatientSafeSelectMinimal = Prisma.PatientGetPayload<{
  select: typeof patientSafeSelectMinimal
}>

export type PatientSafeSelectForPatientSelf = Prisma.PatientGetPayload<{
  select: typeof patientSafeSelectForPatientSelf
}>

export type PatientSafeSelectForDoctor = Prisma.PatientGetPayload<{
  select: typeof patientSafeSelectForDoctor
}>

export type AppointmentSelect = Prisma.AppointmentGetPayload<{
  select: typeof appointmentSelect
}>

export type ConsultationSelectWithSoap = Prisma.ConsultationGetPayload<{
  select: typeof consultationSelectWithSoap
}>

export type FileRecordSelect = Prisma.FileRecordGetPayload<{
  select: typeof fileRecordSelect
}>

export type LabOrderSelect = Prisma.LabOrderGetPayload<{
  select: typeof labOrderSelect
}>

export type IntakeFormResponseSelect = Prisma.IntakeFormGetPayload<{
  select: typeof intakeFormResponseSelect
}>

