import { NextRequest } from 'next/server'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'
import { requireSession, requireRole, getGuardContext } from '@/lib/auth/guards'
import { ensureOwnershipOrDoctor, requireDoctorAccessToPatient } from '@/lib/auth/patient-access'
import { logPatientChartAccess } from '@/lib/logging/audit'
import { prisma } from '@/db/prisma'
import { patientSafeSelectForPatientSelf, patientSafeSelectForDoctor } from '@/lib/db/selects'

export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Allow patient or doctor role
    requireRole(session, ['patient', 'doctor'], context)

    // Get patientId from query params if doctor, otherwise use session
    const patientIdParam = request.nextUrl.searchParams.get('patientId')
    let patientId: string
    let select: any

    if (session.role === 'doctor' && patientIdParam) {
      // Doctor accessing a specific patient's profile
      await requireDoctorAccessToPatient(session, patientIdParam, context)
      patientId = patientIdParam
      select = patientSafeSelectForDoctor
    } else if (session.role === 'patient') {
      // Patient accessing their own profile
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
      select = patientSafeSelectForPatientSelf
    } else {
      return apiError('Invalid access', 403, context.requestId)
    }

    const patient = await prisma.patient.findUnique({
      where: { 
        id: patientId,
        clinicId: session.clinicId,
      },
      select,
    })

    if (!patient) {
      return apiError('Patient profile not found', 404, context.requestId)
    }

    // Audit log: Patient chart access (PHI-safe - only logs metadata)
    logPatientChartAccess(
      session.id,
      session.clinicId,
      patientId,
      context.ip,
      request,
      context.requestId
    ).catch((err) => {
      // Audit logging should never break the request - fail silently
      console.error('Audit logging failed (non-critical):', err)
    })

    return apiSuccess(patient, 200, context.requestId)
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || 'Internal server error'
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

