// TODO: Files API
// TODO: Get files for authenticated patient
// TODO: Upload files
// TODO: Download files

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, requireOwnership, getGuardContext } from '@/lib/auth/guards'
import { prisma } from '@/db/prisma'
import { uploadFile } from '@/lib/gcp/gcp-storage'

// GET - Get patient files
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient role
    requireRole(session, 'patient', context)

    // Get patient record
    const patient = await prisma.patient.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    if (!patient) {
      return apiError('Patient profile not found', 404, context.requestId)
    }

    // Verify ownership - patient can only access their own files
    await requireOwnership(session.id, patient.id, session.role, context)

    const category = request.nextUrl.searchParams.get('category')

    const category = request.nextUrl.searchParams.get('category')

    const files = await prisma.fileRecord.findMany({
      where: {
        patientId: patient.id,
        ...(category && { category }),
      },
      orderBy: { createdAt: 'desc' },
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
    
    // Require patient role
    requireRole(session, 'patient', context)

    // Get patient record
    const patient = await prisma.patient.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    if (!patient) {
      return apiError('Patient profile not found', 404, context.requestId)
    }

    // Verify ownership
    await requireOwnership(session.id, patient.id, session.role, context)

    const formData = await request.formData()
    const file = formData.get('file') as File
    const category = formData.get('category') as string
    const description = formData.get('description') as string

    if (!file) {
      return apiError('File is required', 400)
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
    const fileName = `patients/${patient.id}/${Date.now()}-${file.name}`
    const fileRef = bucket.file(fileName)

    await fileRef.save(buffer, {
      contentType: file.type,
      metadata: {
        uploadedBy: session.id,
        patientId: patient.id,
      },
    })

    // Generate signed URL (valid for 1 year)
    const [url] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
    })

    // Create file record
    const fileRecord = await prisma.fileRecord.create({
      data: {
        patientId: patient.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storageUrl: url,
        storagePath: fileName,
        category: category || 'General',
        description: description || null,
        uploadedBy: session.id,
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

