/**
 * Intake Form API Route - World-Class Access Control Example
 * 
 * Demonstrates comprehensive RBAC for intake form access
 * 
 * This is a refactored version showing the complete access control pattern
 */

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import {
  requireSession,
  requireRole,
  requireClinicAccess,
  requireDoctorAccessToPatient,
  requirePatientSelfAccess,
  getGuardContext,
} from '@/lib/auth/guards'
import { prisma } from '@/db/prisma'
import { intakeFormResponseSelect } from '@/lib/db/selects'
import { z } from 'zod'

const UpdateFormSchema = z.object({
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'PRE_VISIT', 'POST_VISIT', 'ANNUAL']).optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'REVIEWED', 'ARCHIVED']).optional(),
  questions: z.array(z.any()).optional(),
})

/**
 * GET - Get single intake form
 * 
 * Access rules:
 * - Doctors: Can access forms for patients they have relationship with
 * - Patients: Can access their own forms
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session (replaces direct Supabase access)
    const user = await requireSession(request)

    // 2. Require role check
    requireRole(user, ['patient', 'doctor'], context)

    // 3. Fetch form with patient relationship
    const form = await prisma.intakeForm.findUnique({
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

    // 4. Clinic access check (tenant isolation)
    await requireClinicAccess(
      user,
      form.patient.clinicId,
      'intakeForm',
      params.id,
      context
    )

    // 5. Patient assignment check based on role
    if (user.role === 'doctor') {
      // Doctor must have relationship with patient
      await requireDoctorAccessToPatient(user, form.patient.id, context)
    } else if (user.role === 'patient') {
      // Patient must own the form
      await requirePatientSelfAccess(user, form.patient.id, context)
    }

    // 6. PHI access logged automatically in guards above

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

/**
 * PUT - Update form
 * 
 * Access rules:
 * - Doctors: Can update forms for their patients
 * - Patients: Can update their own forms (limited to submission)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session
    const user = await requireSession(request)

    // 2. Require role check
    requireRole(user, ['doctor', 'patient'], context)

    const body = await request.json()
    const validatedData = UpdateFormSchema.parse(body)

    // 3. Fetch form
    const form = await prisma.intakeForm.findUnique({
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

    if (!form) {
      return apiError('Form not found', 404, context.requestId)
    }

    // 4. Clinic access check
    await requireClinicAccess(
      user,
      form.patient.clinicId,
      'intakeForm',
      params.id,
      context
    )

    // 5. Patient assignment check
    if (user.role === 'doctor') {
      await requireDoctorAccessToPatient(user, form.patient.id, context)
    } else if (user.role === 'patient') {
      await requirePatientSelfAccess(user, form.patient.id, context)
      // Patients can only submit forms, not edit structure
      if (validatedData.questions || validatedData.title || validatedData.description) {
        return apiError('Patients cannot modify form structure', 403, context.requestId)
      }
      if (validatedData.status && validatedData.status !== 'SUBMITTED') {
        return apiError('Patients can only submit forms', 403, context.requestId)
      }
    }

    // 6. Update form
    const updated = await prisma.intakeForm.update({
      where: { id: params.id },
      data: validatedData,
      select: intakeFormResponseSelect,
    })

    return apiSuccess(updated, 200, context.requestId)
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError(
        `Validation error: ${error.errors.map((e) => e.message).join(', ')}`,
        400,
        context.requestId
      )
    }

    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'

    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

/**
 * DELETE - Delete form
 * 
 * Access rules:
 * - Doctors: Can delete forms for their patients
 * - Patients: Cannot delete forms (archived only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)

  try {
    // 1. Require valid session
    const user = await requireSession(request)

    // 2. Require doctor role (only doctors can delete)
    requireRole(user, 'doctor', context)

    if (!user.metadata.approved) {
      return apiError('Doctor account pending approval', 403, context.requestId)
    }

    // 3. Fetch form
    const form = await prisma.intakeForm.findUnique({
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

    if (!form) {
      return apiError('Form not found', 404, context.requestId)
    }

    // 4. Clinic access check
    await requireClinicAccess(
      user,
      form.patient.clinicId,
      'intakeForm',
      params.id,
      context
    )

    // 5. Doctor-to-patient access check
    await requireDoctorAccessToPatient(user, form.patient.id, context)

    // 6. Delete form
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

