// TODO: Admin endpoint to approve doctor accounts
// TODO: Require admin role
// TODO: Update doctor approval status
// TODO: Send notification to doctor

import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/api-protection'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/auth/api-protection'

const approveSchema = z.object({
  doctorId: z.string(),
  approved: z.boolean(),
})

export async function POST(request: NextRequest) {
  try {
    // Require admin role
    await requireRole(request, 'admin')

    const body = await request.json()
    const data = approveSchema.parse(body)

    const supabase = await createClient()

    // Update approval status in user_roles table
    const { error } = await supabase
      .from('user_roles')
      .update({ approved: data.approved })
      .eq('user_id', data.doctorId)
      .eq('role', 'doctor')

    if (error) {
      return apiError('Failed to update approval status', 500)
    }

    // TODO: Send notification to doctor
    // TODO: Create notification record

    return apiSuccess({
      message: data.approved
        ? 'Doctor approved successfully'
        : 'Doctor approval revoked',
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message === 'Forbidden') {
      return apiError(error.message, 403)
    }
    if (error instanceof z.ZodError) {
      return apiError(error.errors[0].message, 400)
    }
    return apiError(error.message || 'Internal server error', 500)
  }
}

