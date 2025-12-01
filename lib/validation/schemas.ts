/**
 * Zod Validation Schemas for DistanceDoc API
 * 
 * Centralized validation schemas for all API endpoints.
 * Ensures type safety and data validation before database writes.
 */

import { z } from 'zod'

// ============================================================================
// Appointment Schemas
// ============================================================================

export const createAppointmentSchema = z.object({
  doctorId: z.string().min(1, 'Doctor ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  scheduledAt: z.string().datetime({ message: 'Invalid datetime format' }).or(z.date()),
  duration: z.number().int().positive().max(480).default(30), // Max 8 hours, default 30 minutes
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']).default('SCHEDULED'),
  visitType: z.enum(['VIDEO', 'PHONE', 'IN_PERSON', 'CHAT']).default('VIDEO'),
  reason: z.string().max(5000).optional(), // Max 5000 characters
  notes: z.string().max(10000).optional(), // Max 10000 characters
  meetingUrl: z.string().url().optional().or(z.literal('')),
  meetingId: z.string().max(255).optional(),
})

export const updateAppointmentSchema = z.object({
  scheduledAt: z.string().datetime({ message: 'Invalid datetime format' }).or(z.date()).optional(),
  duration: z.number().int().positive().max(480).optional(), // Max 8 hours
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED']).optional(),
  visitType: z.enum(['VIDEO', 'PHONE', 'IN_PERSON', 'CHAT']).optional(),
  reason: z.string().max(5000).optional(),
  notes: z.string().max(10000).optional(),
  meetingUrl: z.string().url().optional().or(z.literal('')),
  meetingId: z.string().max(255).optional(),
})

// ============================================================================
// Intake Form Response Schema
// ============================================================================

export const intakeResponseSchema = z.object({
  formId: z.string().min(1, 'Form ID is required'),
  patientId: z.string().min(1, 'Patient ID is required'),
  consultationId: z.string().optional(),
  appointmentId: z.string().optional(),
  responses: z.array(
    z.object({
      questionId: z.string().min(1, 'Question ID is required'),
      value: z.union([
        z.string().max(10000), // Text responses
        z.array(z.string().max(1000)), // Multi-select responses
        z.number(), // Numeric responses
        z.boolean(), // Yes/No responses
      ]),
    })
  ).min(1, 'At least one response is required'),
  chiefComplaint: z.string().max(2000).optional(),
  symptoms: z.array(z.string().max(500)).optional(),
  currentMedications: z.array(z.string().max(500)).optional(),
  allergies: z.array(z.string().max(500)).optional(),
  medicalHistory: z.string().max(10000).optional(),
  familyHistory: z.string().max(10000).optional(),
  socialHistory: z.string().max(10000).optional(),
})

// ============================================================================
// Message Schema
// ============================================================================

export const messageSchema = z.object({
  threadId: z.string().min(1, 'Thread ID is required'),
  content: z.string().min(1, 'Message content is required').max(10000, 'Message too long (max 10000 characters)'),
  attachments: z.array(z.string()).optional().default([]), // Array of file record IDs
})

// ============================================================================
// File Upload Schema
// ============================================================================

export const fileUploadSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required').optional(), // Optional - will be validated based on role
  fileName: z.string().min(1, 'File name is required').max(255, 'File name too long'),
  fileType: z.string().min(1, 'File type is required').refine(
    (type) => {
      const allowedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
      ]
      return allowedTypes.includes(type)
    },
    { message: 'File type not allowed. Only images, PDFs, and documents are supported.' }
  ),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  category: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  consultationId: z.string().optional(),
  appointmentId: z.string().optional(),
})

// ============================================================================
// AI SOAP Input Schema
// ============================================================================

export const aiSoapInputSchema = z.object({
  transcript: z.string().min(1, 'Transcript is required').max(50000, 'Transcript too long'),
  symptoms: z.array(z.string().max(500)).optional().default([]),
  patientDemographics: z.object({
    age: z.number().int().positive().max(150).optional(),
    gender: z.string().max(50).optional(),
    medicalHistory: z.string().max(10000).optional(),
    allergies: z.array(z.string().max(500)).optional().default([]),
    currentMedications: z.array(z.string().max(500)).optional().default([]),
  }),
  vitals: z
    .object({
      temperature: z.number().min(90).max(110).optional(), // Fahrenheit range
      bloodPressure: z.string().max(20).optional(), // e.g., "120/80"
      heartRate: z.number().int().positive().max(300).optional(), // bpm
      respiratoryRate: z.number().int().positive().max(60).optional(), // per minute
      oxygenSaturation: z.number().min(0).max(100).optional(), // percentage
      weight: z.number().positive().max(1000).optional(), // pounds
      height: z.string().max(20).optional(), // e.g., "5'10""
    })
    .optional(),
  intakeFormAnswers: z.record(z.any()).optional().default({}),
  appointmentId: z.string().optional(),
  consultationId: z.string().optional(),
})

// ============================================================================
// Consultation Update Schema
// ============================================================================

export const consultationUpdateSchema = z.object({
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  startedAt: z.string().datetime({ message: 'Invalid datetime format' }).or(z.date()).optional(),
  endedAt: z.string().datetime({ message: 'Invalid datetime format' }).or(z.date()).optional(),
  transcription: z.string().max(100000).optional(), // Max 100KB of text
  recordingUrl: z.string().url({ message: 'Invalid URL format' }).optional().or(z.literal('')),
})

// ============================================================================
// Type Exports (for TypeScript inference)
// ============================================================================

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>
export type IntakeResponseInput = z.infer<typeof intakeResponseSchema>
export type MessageInput = z.infer<typeof messageSchema>
export type FileUploadInput = z.infer<typeof fileUploadSchema>
export type AiSoapInput = z.infer<typeof aiSoapInputSchema>
export type ConsultationUpdateInput = z.infer<typeof consultationUpdateSchema>

