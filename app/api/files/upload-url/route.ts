/**
 * File Upload URL API Route - With Strict Ownership and Clinic Enforcement
 * 
 * Generates signed URLs for direct Cloud Storage uploads with:
 * - Ownership validation (doctor or patient themselves)
 * - Clinic ID enforcement
 * - Complete audit trail
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor, requireDoctorAccessToPatient } from '@/lib/auth/patient-access'
import { enforceTenant } from '@/lib/auth/tenant'
import { validate } from '@/lib/validation'
import { fileUploadSchema } from '@/lib/validation/schemas'
import { prisma } from '@/db/prisma'
import { generateSignedUploadUrl, getStorageClient, getBucket } from '@/lib/gcp/gcp-storage'
import { sanitizeFileName, sanitizeString } from '@/lib/security/sanitize'
import { logAudit } from '@/lib/security/logging'
import { z } from 'zod'

/**
 * POST - Generate signed upload URL
 * 
 * Requirements:
 * - User must be a doctor or the patient themselves
 * - Clinic ID must match
 * - Patient ID must be validated
 */
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // 1. Require valid session
    const session = await requireSession(request)
    requireRole(session, ['doctor', 'patient'], context)

    // 2. Validate request body
    const body = await request.json()
    const validatedData = validate(fileUploadSchema, body, context.requestId)
    
    // Sanitize inputs
    const sanitizedFileName = sanitizeFileName(validatedData.fileName)
    const sanitizedDescription = validatedData.description 
      ? sanitizeString(validatedData.description, 1000)
      : undefined

    // 3. Determine and validate patient ID based on role
    let targetPatientId: string
    let targetClinicId: string

    if (session.role === 'patient') {
      // Patient uploading their own file - fetch their patient record
      const patient = await prisma.patient.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: {
          id: true,
          clinicId: true,
        },
      })

      if (!patient) {
        return apiError('Patient profile not found', 404, context.requestId)
      }

      // Enforce: patient can only upload for themselves
      // If patientId is provided, it must match their own ID
      if (validatedData.patientId && validatedData.patientId !== patient.id) {
        logAudit(
          'FILE_UPLOAD_DENIED',
          'patient',
          session.id,
          session.id,
          false,
          {
            requestId: context.requestId,
            reason: 'Patient attempted to upload file for different patient',
            attemptedPatientId: validatedData.patientId,
            ownPatientId: patient.id,
          }
        )
        return apiError('You can only upload files for yourself', 403, context.requestId)
      }

      // Use patient's own ID (patientId not required in request for patients)
      targetPatientId = patient.id
      targetClinicId = patient.clinicId
    } else if (session.role === 'doctor') {
      // Doctor uploading file for a patient - patient ID is required
      if (!validatedData.patientId) {
        return apiError('Patient ID is required for doctor uploads', 400, context.requestId)
      }

      // Enforce: doctor must have access to this patient
      await requireDoctorAccessToPatient(session, validatedData.patientId, context)

      // Fetch patient to get clinic ID
      const patient = await prisma.patient.findUnique({
        where: { id: validatedData.patientId },
        select: {
          id: true,
          clinicId: true,
        },
      })

      if (!patient) {
        return apiError('Patient not found', 404, context.requestId)
      }

      // Enforce: clinic ID must match
      enforceTenant(patient.clinicId, session.clinicId, context)

      targetPatientId = patient.id
      targetClinicId = patient.clinicId
    } else {
      return apiError('Invalid role for file upload', 403, context.requestId)
    }

    // 4. Verify consultation/appointment access if provided (optional additional validation)
    if (validatedData.consultationId) {
      const consultation = await prisma.consultation.findUnique({
        where: { id: validatedData.consultationId },
        select: {
          id: true,
          patientId: true,
          clinicId: true,
        },
      })

      if (!consultation) {
        return apiError('Consultation not found', 404, context.requestId)
      }

      // Enforce: consultation must belong to the same patient and clinic
      if (consultation.patientId !== targetPatientId) {
        return apiError('Consultation does not belong to the specified patient', 400, context.requestId)
      }

      enforceTenant(consultation.clinicId, targetClinicId, context)
    }

    if (validatedData.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: validatedData.appointmentId },
        select: {
          id: true,
          patientId: true,
          clinicId: true,
        },
      })

      if (!appointment) {
        return apiError('Appointment not found', 404, context.requestId)
      }

      // Enforce: appointment must belong to the same patient and clinic
      if (appointment.patientId !== targetPatientId) {
        return apiError('Appointment does not belong to the specified patient', 400, context.requestId)
      }

      enforceTenant(appointment.clinicId, targetClinicId, context)
    }

    // 5. Generate unique file path
    const timestamp = Date.now()
    const filePath = `patients/${targetPatientId}/${timestamp}-${sanitizedFileName}`

    // 6. Generate signed upload URL (valid for 1 hour)
    const uploadUrl = await generateSignedUploadUrl(filePath, validatedData.fileType, 60)

    // 7. Create file record with all required fields
    // Note: createdByUserId is required and tracks who created the file
    const fileRecord = await prisma.fileRecord.create({
      data: {
        patientId: targetPatientId,
        clinicId: targetClinicId,
        createdByUserId: session.id, // Required field for audit trail
        fileName: sanitizedFileName,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize,
        storageUrl: '', // Will be updated after upload completes via PUT endpoint
        storagePath: filePath,
        category: validatedData.category || 'General',
        description: sanitizedDescription || null,
        encrypted: false,
      },
    })

    // 8. Audit log
    logAudit(
      'FILE_UPLOAD_URL_GENERATED',
      'file',
      fileRecord.id,
      session.id,
      true,
      {
        requestId: context.requestId,
        fileName: sanitizedFileName,
        fileSize: validatedData.fileSize,
        patientId: targetPatientId,
        clinicId: targetClinicId,
        userRole: session.role,
      }
    )

    return apiSuccess(
      {
        uploadUrl,
        fileId: fileRecord.id,
        filePath,
        expiresIn: 3600, // 1 hour in seconds
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

/**
 * PUT - Confirm upload completion and update file record
 * 
 * Requirements:
 * - User must be the one who created the file (createdByUserId)
 * - FileRecord clinicId must match user's clinicId
 */
export async function PUT(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // 1. Require valid session
    const session = await requireSession(request)
    requireRole(session, ['doctor', 'patient'], context)

    // 2. Validate request body
    const body = await request.json()
    const { fileId } = z.object({ fileId: z.string().min(1, 'File ID is required') }).parse(body)

    // 3. Fetch file record
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        patientId: true,
        clinicId: true,
        createdByUserId: true,
        storagePath: true,
      },
    })

    if (!fileRecord) {
      return apiError('File record not found', 404, context.requestId)
    }

    // 4. Enforce: FileRecord clinicId must match user's clinicId
    enforceTenant(fileRecord.clinicId, session.clinicId, context)

    // 5. Enforce: User must be the one who created the file
    if (fileRecord.createdByUserId !== session.id) {
      logAudit(
        'FILE_UPLOAD_CONFIRMATION_DENIED',
        'file',
        fileId,
        session.id,
        false,
        {
          requestId: context.requestId,
          reason: 'User is not the file creator',
          fileCreatedBy: fileRecord.createdByUserId,
          attemptedBy: session.id,
        }
      )
      return apiError('You can only confirm uploads for files you created', 403, context.requestId)
    }

    // 6. Initialize Storage client and verify file exists
    const storage = getStorageClient()
    const bucket = getBucket()
    const file = bucket.file(fileRecord.storagePath)

    // Check if file exists in storage
    const [exists] = await file.exists()
    if (!exists) {
      return apiError('File not found in storage', 404, context.requestId)
    }

    // 7. Generate signed URL for download access
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    })

    // 8. Update file record with storage URL
    const updated = await prisma.fileRecord.update({
      where: { id: fileId },
      data: {
        storageUrl: downloadUrl,
      },
      select: {
        id: true,
        fileName: true,
        fileType: true,
        fileSize: true,
        storageUrl: true,
        category: true,
        createdAt: true,
      },
    })

    // 9. Audit log
    logAudit(
      'FILE_UPLOAD_CONFIRMED',
      'file',
      fileId,
      session.id,
      true,
      {
        requestId: context.requestId,
        patientId: fileRecord.patientId,
        clinicId: fileRecord.clinicId,
      }
    )

    return apiSuccess(updated, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}
