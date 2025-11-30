// TODO: Submit patient form responses
// TODO: Save responses to Consultation.intakeData
// TODO: Validate responses against form structure

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, requireOwnership, getGuardContext } from '@/lib/auth/guards'
import { verifyClinicAccess, withClinicScope } from '@/lib/auth/tenant-scope'
import { prisma } from '@/db/prisma'
import { z } from 'zod'
import type { FormResponse, ConsultationIntakeData } from '@/lib/forms/types'

// Form submission schema
const SubmitFormSchema = z.object({
  consultationId: z.string(),
  responses: z.array(
    z.object({
      questionId: z.string(),
      value: z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
    })
  ),
})

// POST - Submit form responses
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require patient or doctor role
    requireRole(session, ['patient', 'doctor'], context)

    const body = await request.json()
    const validatedData = SubmitFormSchema.parse(body)

    // Get form to validate structure
    const form = await prisma.intakeForm.findUnique({
      where: { id: params.id },
    })

    if (!form) {
      return apiError('Form not found', 404, context.requestId)
    }

    // Verify consultation exists and user has access (with clinic scoping)
    const consultation = await prisma.consultation.findUnique({
      where: { id: validatedData.consultationId },
      include: {
        patient: {
          select: { clinicId: true },
        },
        doctor: {
          select: { clinicId: true },
        },
      },
    })

    if (!consultation) {
      return apiError('Consultation not found', 404, context.requestId)
    }

    // Verify clinic access
    verifyClinicAccess(
      consultation.patient.clinicId,
      session.clinicId,
      'consultation',
      validatedData.consultationId,
      context.requestId
    )

    // Verify ownership - patient or doctor must own the consultation
    if (session.role === 'patient') {
      const patient = await prisma.patient.findUnique({
        where: { userId: session.id },
        select: { id: true },
      })
      if (patient && consultation.patientId === patient.id) {
        await requireOwnership(session.id, patient.id, session.role, context)
      } else {
        return apiError('Unauthorized', 403, context.requestId)
      }
    } else if (session.role === 'doctor') {
      const doctor = await prisma.doctor.findUnique({
        where: { userId: session.id },
        select: { id: true },
      })
      if (doctor && consultation.doctorId === doctor.id) {
        // Doctor has access through relationship
      } else {
        return apiError('Unauthorized', 403, context.requestId)
      }
    }

    // Prepare intake data
    const intakeData: ConsultationIntakeData = {
      formId: params.id,
      responses: validatedData.responses,
      submittedAt: new Date(),
    }

    // Update consultation with intake data
    // Store in a JSON field - you may want to add intakeData to Consultation model
    // For now, we'll update the related IntakeForm with the consultation reference
    await prisma.intakeForm.update({
      where: { id: params.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        formData: {
          ...(form.formData as any),
          consultationId: validatedData.consultationId,
          responses: validatedData.responses,
          submittedAt: new Date().toISOString(),
        },
      },
    })

    // Also create/update a record linking consultation to intake data
    // You might want to add this to the Consultation model or create a separate table

    // Also update intake form status
    await prisma.intakeForm.update({
      where: { id: params.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    })

    return apiSuccess(
      {
        success: true,
        message: 'Form submitted successfully',
      },
      200,
      context.requestId
    )
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

