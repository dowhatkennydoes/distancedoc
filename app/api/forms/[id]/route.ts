// TODO: Single form CRUD operations
// TODO: Get, update, delete specific form
// TODO: Validate form ownership

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { verifyClinicAccess } from '@/lib/auth/tenant-scope'
import { prisma } from '@/db/prisma'
import { z } from 'zod'

// TODO: Update form schema
const UpdateFormSchema = z.object({
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'PRE_VISIT', 'POST_VISIT', 'ANNUAL']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'REVIEWED', 'ARCHIVED']).optional(),
  questions: z.array(z.any()).optional(),
})

// GET - Get single form
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Allow patient or doctor to view forms
    requireRole(session, ['patient', 'doctor'], context)

    const form = await prisma.intakeForm.findUnique({
      where: { id: params.id },
      include: {
        patient: {
          select: { clinicId: true },
        },
      },
    })

    if (!form) {
      return apiError('Form not found', 404, context.requestId)
    }

    // Verify clinic access
    verifyClinicAccess(
      form.patient.clinicId,
      session.clinicId,
      'intakeForm',
      params.id,
      context.requestId
    )

    return apiSuccess(form, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// PUT - Update form
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError('Doctor account pending approval', 403, context.requestId)
    }

    const body = await request.json()
    const validatedData = UpdateFormSchema.parse(body)

    // Verify form ownership
    const existingForm = await prisma.intakeForm.findUnique({
      where: { id: params.id },
    })

    if (!existingForm) {
      return apiError('Form not found', 404, context.requestId)
    }

    // Update form
    const updatedForm = await prisma.intakeForm.update({
      where: { id: params.id },
      data: {
        ...(validatedData.type && { type: validatedData.type }),
        ...(validatedData.status && { status: validatedData.status }),
        ...(validatedData.title || validatedData.description || validatedData.questions
          ? {
              formData: {
                ...(existingForm.formData as any),
                ...(validatedData.title && { title: validatedData.title }),
                ...(validatedData.description && { description: validatedData.description }),
                ...(validatedData.questions && { questions: validatedData.questions }),
              },
            }
          : {}),
      },
    })

    return apiSuccess(updatedForm, 200, context.requestId)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError(`Validation error: ${error.errors.map((e) => e.message).join(', ')}`, 400, context.requestId)
    }
    
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// DELETE - Delete form
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError('Doctor account pending approval', 403, context.requestId)
    }

    await prisma.intakeForm.delete({
      where: { id: params.id },
    })

    return apiSuccess({ success: true }, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

