// TODO: Generate signed upload URL endpoint
// TODO: Create signed URL for direct Cloud Storage upload
// TODO: Support image and PDF uploads
// TODO: Save metadata in FileRecord table
// TODO: Associate with consultations or patient charts
// TODO: Validate file types and sizes

import { NextRequest } from 'next/server'
import { requireAuth, apiError } from '@/lib/auth/api-protection'
import { prisma } from '@/db/prisma'
import { generateSignedUploadUrl, getStorageClient, getBucket } from '@/lib/gcp/gcp-storage'
import { z } from 'zod'
import { firestoreRateLimiters } from '@/lib/security/firestore-rate-limit'
import { sanitizeFileName, sanitizeString } from '@/lib/security/sanitize'
import { addSecurityHeaders } from '@/lib/security/headers'
import { logError, logAudit } from '@/lib/security/logging'
import { handleApiError } from '@/lib/security/error-handler'
import { v4 as uuidv4 } from 'uuid'

// TODO: Request validation schema
const UploadUrlRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.string().refine(
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
      ]
      return allowedTypes.includes(type)
    },
    { message: 'File type not allowed. Only images and PDFs are supported.' }
  ),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024, 'File size must be less than 10MB'),
  category: z.string().optional(),
  description: z.string().optional(),
  consultationId: z.string().optional(),
  appointmentId: z.string().optional(),
})

// TODO: POST - Generate signed upload URL
export async function POST(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Require authentication first (needed for user ID)
    const user = await requireAuth(request)
    
    // Rate limiting: 10 uploads per minute
    const rateLimitResponse = await firestoreRateLimiters.upload(request, user.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    // Get patient or doctor record
    const patient = await prisma.patient.findUnique({
      where: { userId: user.id },
    })

    const doctor = await prisma.doctor.findUnique({
      where: { userId: user.id },
    })

    if (!patient && !doctor) {
      return apiError('User profile not found', 404)
    }

    // Parse and validate request body (limit size)
    const body = await request.json()
    
    // Limit request body size (10MB max)
    if (JSON.stringify(body).length > 10 * 1024 * 1024) {
      return addSecurityHeaders(apiError('Request body too large', 413))
    }
    
    const validatedData = UploadUrlRequestSchema.parse(body)
    
    // Sanitize file name
    validatedData.fileName = sanitizeFileName(validatedData.fileName)
    if (validatedData.description) {
      validatedData.description = sanitizeString(validatedData.description, 500)
    }

    // Verify consultation/appointment access if provided
    if (validatedData.consultationId) {
      const consultation = await prisma.consultation.findUnique({
        where: { id: validatedData.consultationId },
      })

      if (!consultation) {
        return apiError('Consultation not found', 404)
      }

      // Verify user has access to this consultation
      if (patient && consultation.patientId !== patient.id) {
        return apiError('Unauthorized', 403)
      }
      if (doctor && consultation.doctorId !== doctor.id) {
        return apiError('Unauthorized', 403)
      }
    }

    if (validatedData.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: validatedData.appointmentId },
      })

      if (!appointment) {
        return apiError('Appointment not found', 404)
      }

      // Verify user has access to this appointment
      if (patient && appointment.patientId !== patient.id) {
        return apiError('Unauthorized', 403)
      }
      if (doctor && appointment.doctorId !== doctor.id) {
        return apiError('Unauthorized', 403)
      }
    }

    // Determine patient ID for file association
    let patientId: string
    if (patient) {
      patientId = patient.id
    } else if (validatedData.consultationId) {
      const consultation = await prisma.consultation.findUnique({
        where: { id: validatedData.consultationId },
        select: { patientId: true },
      })
      patientId = consultation!.patientId
    } else if (validatedData.appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: validatedData.appointmentId },
        select: { patientId: true },
      })
      patientId = appointment!.patientId
    } else {
      return apiError('Patient association required (consultationId or appointmentId)', 400)
    }

    // Generate unique file path (already sanitized)
    const timestamp = Date.now()
    const filePath = `patients/${patientId}/${timestamp}-${validatedData.fileName}`

    // Generate signed upload URL (valid for 1 hour)
    const uploadUrl = await generateSignedUploadUrl(filePath, validatedData.fileType, 60)

    // Create file record in database (status: PENDING until upload completes)
    const fileRecord = await prisma.fileRecord.create({
      data: {
        patientId,
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize,
        storageUrl: '', // Will be updated after upload
        storagePath: filePath,
        category: validatedData.category || 'General',
        description: validatedData.description || null,
        uploadedBy: user.id,
        encrypted: false,
      },
    })

    logAudit('FILE_UPLOAD_URL_GENERATED', 'file', fileRecord.id, user.id, true, {
      requestId,
      fileName: validatedData.fileName,
      fileSize: validatedData.fileSize,
    })
    
    const response = new Response(
      JSON.stringify({
        uploadUrl,
        fileId: fileRecord.id,
        filePath,
        expiresIn: 3600, // 1 hour in seconds
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to generate upload URL', undefined, requestId))
  }
}

// TODO: PUT - Confirm upload completion and update file record
export async function PUT(request: NextRequest) {
  const requestId = uuidv4()
  
  try {
    // Require authentication first (needed for user ID)
    const user = await requireAuth(request)
    
    // Rate limiting: 10 uploads per minute
    const rateLimitResponse = await firestoreRateLimiters.upload(request, user.id)
    if (rateLimitResponse) {
      return addSecurityHeaders(rateLimitResponse)
    }

    const body = await request.json()
    const { fileId } = z.object({ fileId: z.string() }).parse(body)

    // Get file record
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: fileId },
    })

    if (!fileRecord) {
      return apiError('File record not found', 404)
    }

    // Verify user has access
    if (fileRecord.uploadedBy !== user.id) {
      return apiError('Unauthorized', 403)
    }

    // Generate signed download URL
    const storage = getStorageClient()
    const bucket = getBucket()
    const file = bucket.file(fileRecord.storagePath)

    // Check if file exists
    const [exists] = await file.exists()
    if (!exists) {
      return apiError('File not found in storage', 404)
    }

    // Generate signed URL for access
    const [downloadUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    })

    // Update file record with storage URL
    const updated = await prisma.fileRecord.update({
      where: { id: fileId },
      data: {
        storageUrl: downloadUrl,
      },
    })

    logAudit('FILE_UPLOAD_CONFIRMED', 'file', fileRecord.id, user.id, true, { requestId })
    
    const response = new Response(JSON.stringify(updated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    return addSecurityHeaders(response)
  } catch (error: any) {
    return addSecurityHeaders(handleApiError(error, 'Failed to confirm upload', undefined, requestId))
  }
}

