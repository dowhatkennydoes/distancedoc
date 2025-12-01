/**
 * File Get URL API Route - Get signed URL for viewing file
 * 
 * Provides secure file access with:
 * - Ownership validation (requireOwnershipOrDoctor)
 * - Clinic ID matching
 * - Complete audit trail
 */

import { NextRequest } from 'next/server'
import { Storage } from '@google-cloud/storage'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { enforceTenant } from '@/lib/auth/tenant'
import { logAccess } from '@/lib/logging/audit'
import { prisma } from '@/db/prisma'

/**
 * GET - Get signed URL for viewing file
 * 
 * Requirements:
 * - FileRecord must match user's clinic
 * - User must have rights to view the file (ownership or doctor access)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session
    const user = await requireSession(request)
    requireRole(user, ['doctor', 'patient'], context)

    // 2. Fetch file record with patient relationship
    const fileRecord = await prisma.fileRecord.findUnique({
      where: { id: params.id },
      include: {
        patient: {
          select: {
            id: true,
            clinicId: true,
          },
        },
      },
    })

    if (!fileRecord) {
      return apiError('File not found', 404, context.requestId)
    }

    // 3. Enforce: FileRecord clinicId must match user's clinicId
    enforceTenant(fileRecord.clinicId, user.clinicId, context)

    // 4. Enforce: User must have rights to view the file
    // This checks if user is the patient themselves or a doctor with access
    await ensureOwnershipOrDoctor(user, fileRecord.patient.id, context)

    // 5. Initialize Storage client
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
    const file = bucket.file(fileRecord.storagePath)

    // 6. Check if file exists in storage
    const [exists] = await file.exists()
    if (!exists) {
      return apiError('File not found in storage', 404, context.requestId)
    }

    // 7. Generate signed URL for viewing (valid for 1 hour)
    const [viewUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    })

    // 8. Audit log: File view access (PHI-safe - only logs metadata)
    logAccess({
      userId: user.id,
      clinicId: user.clinicId,
      action: 'GET_FILE_VIEW_URL',
      resourceType: 'file',
      resourceId: params.id,
      ip: context.ip,
      request,
      requestId: context.requestId,
      success: true,
      metadata: {
        fileSize: fileRecord.fileSize,
        fileType: fileRecord.fileType,
        category: fileRecord.category || undefined,
      },
    }).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

    return apiSuccess(
      {
        viewUrl,
        fileId: fileRecord.id,
        fileName: fileRecord.fileName,
        fileType: fileRecord.fileType,
        expiresIn: 3600, // 1 hour in seconds
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

