// TODO: Files API
// TODO: Get files for authenticated patient
// TODO: Upload files
// TODO: Download files

import { NextRequest } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { withClinicScope } from '@/lib/auth/tenant-scope'
import { validate } from '@/lib/validation'
import { fileUploadSchema } from '@/lib/validation/schemas'
import { logFileListAccess } from '@/lib/logging/audit'
import { prisma } from '@/db/prisma'
import { fileRecordSelect } from '@/lib/db/selects'

// GET - Get patient files
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Allow patient or doctor role
    requireRole(session, ['patient', 'doctor'], context)

    // Get patientId from query params if doctor, otherwise from session
    const patientIdParam = request.nextUrl.searchParams.get('patientId')
    let patientId: string

    if (session.role === 'doctor' && patientIdParam) {
      // Doctor accessing specific patient's files
      await ensureOwnershipOrDoctor(session, patientIdParam, context)
      patientId = patientIdParam
    } else if (session.role === 'patient') {
      // Patient accessing their own files
      const patient = await prisma.patient.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!patient) {
        return apiError('Patient profile not found', 404, context.requestId)
      }

      await ensureOwnershipOrDoctor(session, patient.id, context)
      patientId = patient.id
    } else {
      return apiError('Invalid access', 403, context.requestId)
    }

    const category = request.nextUrl.searchParams.get('category')

    // Get files with clinic scoping using safe select
    const files = await prisma.fileRecord.findMany({
      where: withClinicScope(session.clinicId, {
        patientId,
        ...(category && { category }),
      }),
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
      orderBy: { createdAt: 'desc' },
    })

    // Audit log: Patient files list access (PHI-safe - only logs metadata)
    logFileListAccess(
      session.id,
      session.clinicId,
      patientId,
      files.length,
      context.ip,
      request,
      context.requestId
    ).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

    return apiSuccess(files, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// POST - Upload file
export async function POST(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Allow patient or doctor role (doctors may upload files for patients)
    requireRole(session, ['patient', 'doctor'], context)

    // Get form data and validate
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return apiError('File is required', 400, context.requestId)
    }

    // Build validation payload from form data
    const uploadPayload = {
      patientId: formData.get('patientId') as string,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      category: formData.get('category') as string | undefined,
      description: formData.get('description') as string | undefined,
      consultationId: formData.get('consultationId') as string | undefined,
      appointmentId: formData.get('appointmentId') as string | undefined,
    }

    // Validate upload data
    const validatedData = validate(fileUploadSchema, uploadPayload, context.requestId)

    // Determine patient ID and verify access
    let patientId: string

    if (session.role === 'doctor' && validatedData.patientId) {
      // Doctor uploading file for a specific patient
      await ensureOwnershipOrDoctor(session, validatedData.patientId, context)
      patientId = validatedData.patientId
    } else if (session.role === 'patient') {
      // Patient uploading their own file
      const patient = await prisma.patient.findUnique({
        where: { 
          userId: session.id,
          clinicId: session.clinicId,
        },
        select: { id: true },
      })

      if (!patient) {
        return apiError('Patient profile not found', 404, context.requestId)
      }

      await ensureOwnershipOrDoctor(session, patient.id, context)
      patientId = patient.id
      
      // Ensure patientId matches if provided
      if (validatedData.patientId && validatedData.patientId !== patient.id) {
        return apiError('You can only upload files for yourself', 403, context.requestId)
      }
    } else {
      return apiError('Invalid access', 403, context.requestId)
    }

    // Upload to Cloud Storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Initialize Storage client
    const serviceAccountJson = process.env.GCP_SERVICE_ACCOUNT
      ? Buffer.from(process.env.GCP_SERVICE_ACCOUNT, 'base64').toString('utf-8')
      : null

    const storage = serviceAccountJson
      ? new Storage({
          projectId: process.env.GCP_PROJECT_ID || 'distancedoc',
          credentials: JSON.parse(serviceAccountJson),
        })
      : new Storage({
          projectId: process.env.GCP_PROJECT_ID || 'distancedoc',
        })

    const bucket = storage.bucket(process.env.GCP_STORAGE_BUCKET || 'distancedoc-uploads')
    const fileName = `patients/${patientId}/${Date.now()}-${validatedData.fileName}`
    const fileRef = bucket.file(fileName)

    await fileRef.save(buffer, {
      contentType: validatedData.fileType,
      metadata: {
        uploadedBy: session.id,
        patientId,
      },
    })

    // Generate signed URL (valid for 1 year)
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    })

    // Create file record with clinic scoping and required fields
    const fileRecord = await prisma.fileRecord.create({
      data: {
        patientId,
        clinicId: session.clinicId,
        createdByUserId: session.id, // Required field for audit trail
        fileName: validatedData.fileName,
        fileType: validatedData.fileType,
        fileSize: validatedData.fileSize,
        storageUrl: url,
        storagePath: fileName,
        category: validatedData.category || 'General',
        description: validatedData.description || null,
      },
    })

    return apiSuccess(fileRecord, 201, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

