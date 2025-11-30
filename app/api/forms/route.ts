// TODO: Intake form CRUD API
// TODO: Create, read, update, delete intake forms
// TODO: List forms by doctor
// TODO: Validate form structure

import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { prisma } from '@/db/prisma'
import { z } from 'zod'
import type { FormQuestion } from '@/lib/forms/types'

// TODO: Form creation schema
const CreateFormSchema = z.object({
  type: z.enum(['INITIAL', 'FOLLOW_UP', 'PRE_VISIT', 'POST_VISIT', 'ANNUAL']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  questions: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['text', 'yesno', 'scale', 'multiselect', 'textarea']),
      label: z.string().min(1, 'Label is required'),
      required: z.boolean(),
      order: z.number().int().positive(),
      options: z.array(z.string()).optional(),
      scaleMin: z.number().optional(),
      scaleMax: z.number().optional(),
      scaleLabelMin: z.string().optional(),
      scaleLabelMax: z.string().optional(),
      placeholder: z.string().optional(),
      validation: z
        .object({
          minLength: z.number().optional(),
          maxLength: z.number().optional(),
          pattern: z.string().optional(),
        })
        .optional(),
    })
  ),
})

// GET - List forms for authenticated doctor
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError('Doctor account pending approval', 403, context.requestId)
    }

    // Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    if (!doctor) {
      return apiError('Doctor profile not found', 404, context.requestId)
    }

    const type = request.nextUrl.searchParams.get('type')
    const status = request.nextUrl.searchParams.get('status')
    const patientId = request.nextUrl.searchParams.get('patientId')

    let where: any = {}

    if (patientId) {
      // Get forms assigned to this patient
      where.patientId = patientId
    } else {
      // Get forms created by this doctor (templates)
      // Note: Forms are templates. For now, we'll store doctorId in formData
      const allForms = await prisma.intakeForm.findMany({
        where: {
          ...(type && { type: type as any }),
          ...(status && { status: status as any }),
        },
        orderBy: { createdAt: 'desc' },
      })

      // Filter forms by doctor (stored in formData.doctorId)
      const forms = allForms.filter((form) => {
        const formData = form.formData as any
        return formData?.doctorId === doctor.id
      })

      return apiSuccess(forms, 200, context.requestId)
    }

    if (type) where.type = type
    if (status) where.status = status

    const forms = await prisma.intakeForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return apiSuccess(forms, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// POST - Create new intake form
export async function POST(request: NextRequest) {
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
    const validatedData = CreateFormSchema.parse(body)

    // Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.id },
      select: { id: true },
    })

    if (!doctor) {
      return apiError('Doctor profile not found', 404, context.requestId)
    }

    // Create form template (we'll use a placeholder patient for now)
    // In production, consider adding a doctorId field or a separate FormTemplate model
    // For now, we'll create a dummy patient record or use formData to store doctorId
    
    // Get or create a placeholder patient for form templates
    // This is a workaround - ideally forms should be templates not tied to patients
    const placeholderPatient = await prisma.patient.findFirst({
      where: { userId: user.id }, // Temporary: use doctor's user ID to find/create placeholder
    })

    if (!placeholderPatient) {
      return apiError('Patient record required for form creation', 400)
    }

    // Create form with questions in formData JSON
    const form = await prisma.intakeForm.create({
      data: {
        patientId: placeholderPatient.id,
        type: validatedData.type,
        status: 'DRAFT',
        formData: {
          doctorId: doctor.id, // Store doctor ID in formData
          title: validatedData.title,
          description: validatedData.description,
          questions: validatedData.questions,
          isTemplate: true, // Mark as template
        },
      },
    })

    return apiSuccess(form, 201, context.requestId)
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

