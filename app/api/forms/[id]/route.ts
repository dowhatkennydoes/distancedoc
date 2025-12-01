// TODO: Single form CRUD operations
// TODO: Get, update, delete specific form
// TODO: Validate form ownership

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { enforceTenant } from '@/lib/auth/tenant'
import { prisma } from '@/db/prisma'
import { intakeFormResponseSelect } from '@/lib/db/selects'
import { z } from 'zod'
import { getCachedIntakeTemplate, setCachedIntakeTemplate, invalidateIntakeTemplate } from '@/lib/cache/intake-templates'

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

    // Try to get from cache first
    let form = await getCachedIntakeTemplate(params.id)

    if (!form) {
      // Cache miss - fetch from database
      form = await prisma.intakeForm.findUnique({
        where: { id: params.id },
        select: {
          ...intakeFormResponseSelect,
          patient: {
            select: {
              clinicId: true,
              id: true,
              firstName: true,
              lastName: true,
              dateOfBirth: true,
            },
          },
        },
      })

      if (!form) {
        return apiError('Form not found', 404, context.requestId)
      }

      // Cache the form template (1 hour TTL)
      await setCachedIntakeTemplate(params.id, form, 3600)
    }

    // SECURITY: Enforce tenant isolation - verify clinicId matches
    enforceTenant(form.clinicId, session.clinicId, context)

    // Verify user has access to this patient's form
    await ensureOwnershipOrDoctor(session, form.patientId, context)

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
    requireRole(session, ['doctor'], context)
    
    if (!session.metadata.approved) {
      return apiError('Doctor account pending approval', 403, context.requestId)
    }

    const body = await request.json()
    const validatedData = UpdateFormSchema.parse(body)

    // Verify form exists and belongs to user's clinic
    const existingForm = await prisma.intakeForm.findUnique({
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

    if (!existingForm) {
      return apiError('Form not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation - verify clinicId matches
    if (existingForm.clinicId !== session.clinicId) {
      return apiError('Forbidden: Form belongs to different clinic', 403, context.requestId)
    }

    // Verify doctor has access to this patient's form
    await ensureOwnershipOrDoctor(session, existingForm.patientId, context)

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
      select: intakeFormResponseSelect,
    })

    // Invalidate cache after update
    await invalidateIntakeTemplate(params.id)

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
    requireRole(session, ['doctor'], context)
    
    if (!session.metadata.approved) {
      return apiError('Doctor account pending approval', 403, context.requestId)
    }

    // SECURITY: Verify form exists and belongs to user's clinic before deletion
    const existingForm = await prisma.intakeForm.findUnique({
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

    if (!existingForm) {
      return apiError('Form not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation - verify clinicId matches
    if (existingForm.clinicId !== session.clinicId) {
      return apiError('Forbidden: Form belongs to different clinic', 403, context.requestId)
    }

    // Verify doctor has access to this patient's form
    await ensureOwnershipOrDoctor(session, existingForm.patientId, context)

    await prisma.intakeForm.delete({
      where: { id: params.id },
    })

    // Invalidate cache after deletion
    await invalidateIntakeTemplate(params.id)

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

