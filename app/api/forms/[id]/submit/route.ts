// TODO: Submit patient form responses
// TODO: Save responses to Consultation.intakeData
// TODO: Validate responses against form structure

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor } from '@/lib/auth/patient-access'
import { enforceTenant } from '@/lib/auth/tenant'
import { validate } from '@/lib/validation'
import { intakeResponseSchema } from '@/lib/validation/schemas'
import { prisma } from '@/db/prisma'
import type { FormResponse, ConsultationIntakeData } from '@/lib/forms/types'

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
    const validatedData = validate(intakeResponseSchema, body, context.requestId)

    // OPTIMIZED: Get form with clinicId validation and minimal SELECT
    const form = await prisma.intakeForm.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        clinicId: true,
        patientId: true,
        type: true,
        status: true,
        formData: true,
      },
    })

    if (!form) {
      return apiError('Form not found', 404, context.requestId)
    }

    // SECURITY: Enforce tenant isolation
    if (form.clinicId !== session.clinicId) {
      return apiError('Forbidden: Form belongs to different clinic', 403, context.requestId)
    }

    // Verify consultation exists and user has access (with clinic scoping)
    const consultationId = validatedData.consultationId || validatedData.appointmentId
    if (!consultationId) {
      return apiError('Consultation ID or Appointment ID is required', 400, context.requestId)
    }
    
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
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

    // SECURITY: Enforce tenant isolation
    enforceTenant(consultation.clinicId, session.clinicId, context)

    // Verify user has access to this patient's form
    await ensureOwnershipOrDoctor(session, consultation.patientId, context)

    // Prepare intake data
    const intakeData: ConsultationIntakeData = {
      formId: params.id,
      responses: validatedData.responses,
      submittedAt: new Date(),
    }

    // Update intake form with responses and status
    await prisma.intakeForm.update({
      where: { id: params.id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        formData: {
          ...(form.formData as any),
          consultationId: consultationId,
          responses: validatedData.responses,
          submittedAt: new Date().toISOString(),
        },
        chiefComplaint: validatedData.chiefComplaint,
        symptoms: validatedData.symptoms,
        currentMedications: validatedData.currentMedications,
        allergies: validatedData.allergies,
        medicalHistory: validatedData.medicalHistory,
        familyHistory: validatedData.familyHistory,
        socialHistory: validatedData.socialHistory,
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
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

