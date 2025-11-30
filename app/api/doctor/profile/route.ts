// TODO: Doctor profile API
// TODO: Get and update doctor profile
// TODO: Include user information

import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/auth/api-protection"
import { requireSession, requireRole, getGuardContext } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { createClient } from "@/lib/supabase/server"
import { z } from "zod"

const UpdateProfileSchema = z.object({
  user: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phoneNumber: z.string().optional(),
  }).optional(),
  doctor: z.object({
    specialization: z.string().optional(),
    credentials: z.array(z.string()).optional(),
    npiNumber: z.string().optional(),
    bio: z.string().optional(),
    languages: z.array(z.string()).optional(),
    timezone: z.string().optional(),
  }).optional(),
})

// GET - Get doctor profile
export async function GET(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError("Doctor account pending approval", 403, context.requestId)
    }

    // Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.id },
    })

    if (!doctor) {
      return apiError("Doctor profile not found", 404, context.requestId)
    }

    // Get user information from Supabase
    const supabase = await createClient()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return apiError("User not found", 404)
    }

    // Get user metadata
    const userMetadata = userData.user.user_metadata || {}

    return apiSuccess(
      {
        doctor,
        user: {
          firstName: userMetadata.firstName || "",
          lastName: userMetadata.lastName || "",
          email: userData.user.email || "",
          phoneNumber: userMetadata.phoneNumber || "",
        },
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || "Internal server error"
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

// PUT - Update doctor profile
export async function PUT(request: NextRequest) {
  const context = getGuardContext(request)
  
  try {
    // Require valid session
    const session = await requireSession(request)
    
    // Require doctor role and approval
    requireRole(session, 'doctor', context)
    
    if (!session.metadata.approved) {
      return apiError("Doctor account pending approval", 403, context.requestId)
    }

    const body = await request.json()
    const validatedData = UpdateProfileSchema.parse(body)

    // Get doctor record
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.id },
    })

    if (!doctor) {
      return apiError("Doctor profile not found", 404, context.requestId)
    }

    // Update doctor profile
    if (validatedData.doctor) {
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          ...(validatedData.doctor.specialization !== undefined && {
            specialization: validatedData.doctor.specialization,
          }),
          ...(validatedData.doctor.credentials !== undefined && {
            credentials: validatedData.doctor.credentials,
          }),
          ...(validatedData.doctor.npiNumber !== undefined && {
            npiNumber: validatedData.doctor.npiNumber,
          }),
          ...(validatedData.doctor.bio !== undefined && {
            bio: validatedData.doctor.bio,
          }),
          ...(validatedData.doctor.languages !== undefined && {
            languages: validatedData.doctor.languages,
          }),
          ...(validatedData.doctor.timezone !== undefined && {
            timezone: validatedData.doctor.timezone,
          }),
        },
      })
    }

    // Update user information in Supabase
    if (validatedData.user) {
      const supabase = await createClient()
      const updates: any = {}

      if (validatedData.user.firstName !== undefined) {
        updates.firstName = validatedData.user.firstName
      }
      if (validatedData.user.lastName !== undefined) {
        updates.lastName = validatedData.user.lastName
      }
      if (validatedData.user.email !== undefined) {
        updates.email = validatedData.user.email
      }
      if (validatedData.user.phoneNumber !== undefined) {
        updates.phoneNumber = validatedData.user.phoneNumber
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: updates,
          ...(updates.email && { email: updates.email }),
        })

        if (updateError) {
          return apiError(`Failed to update user: ${updateError.message}`, 500)
        }
      }
    }

    // Fetch updated doctor profile
    const updatedDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
    })

    const supabase = await createClient()
    const { data: userData } = await supabase.auth.getUser()
    const userMetadata = userData?.user?.user_metadata || {}

    return apiSuccess(
      {
        doctor: updatedDoctor,
        user: {
          firstName: userMetadata.firstName || "",
          lastName: userMetadata.lastName || "",
          email: userData?.user?.email || "",
          phoneNumber: userMetadata.phoneNumber || "",
        },
      },
      200,
      context.requestId
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return apiError(`Validation error: ${error.errors.map((e) => e.message).join(", ")}`, 400, context.requestId)
    }
    
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500
    const message = error.message || "Internal server error"
    
    if (statusCode === 401 || statusCode === 403) {
      return apiError(message, statusCode, context.requestId)
    }
    return apiError(message, statusCode, context.requestId)
  }
}

