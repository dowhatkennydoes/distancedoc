// TODO: 7-day follow-up message automation
// TODO: Triggered by Cloud Scheduler (runs daily)
// TODO: Query consultations completed 7 days ago
// TODO: Send follow-up email/SMS to patients
// TODO: Create notification records
// TODO: Handle errors and retries

import { CloudEvent } from '@google-cloud/functions-framework'
import { getPrismaClient, closeDatabase } from '../lib/database'
import { sendEmail, sendSMS, emailTemplates, smsTemplates } from '../lib/notifications'

export const followUp7d = async (cloudEvent: CloudEvent) => {
  const prisma = getPrismaClient()
  let processed = 0
  let errors = 0

  try {
    // Calculate date 7 days ago
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // Query consultations completed 7 days ago (within a 1-day window)
    const eightDaysAgo = new Date()
    eightDaysAgo.setDate(eightDaysAgo.getDate() - 8)

    const consultations = await prisma.consultation.findMany({
      where: {
        status: 'COMPLETED',
        endedAt: {
          gte: eightDaysAgo,
          lte: sevenDaysAgo,
        },
      },
      include: {
        patient: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phoneNumber: true,
              },
            },
          },
        },
        doctor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        appointment: {
          select: {
            scheduledAt: true,
          },
        },
      },
    })

    console.log(`Found ${consultations.length} consultations for 7d follow-up`)

    // Process each consultation
    for (const consultation of consultations) {
      try {
        // Check if we already sent a 7d follow-up
        // Note: Prisma doesn't support JSON path queries directly, so we'll check by type and message
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: consultation.patient.user.id,
            type: 'APPOINTMENT_REMINDER',
            title: {
              contains: 'Follow-up: How are you feeling?',
            },
            createdAt: {
              gte: eightDaysAgo,
            },
          },
        })

        if (existingNotification) {
          console.log(`Skipping consultation ${consultation.id} - already notified`)
          continue
        }

        const patientName = `${consultation.patient.user.firstName || ''} ${consultation.patient.user.lastName || ''}`.trim() || 'Patient'
        const doctorName = `${consultation.doctor.user.firstName || ''} ${consultation.doctor.user.lastName || ''}`.trim() || 'Doctor'
        const appointmentDate = consultation.appointment.scheduledAt.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })

        // Send email
        if (consultation.patient.user.email) {
          const emailTemplate = emailTemplates.followUp7d(patientName, doctorName, appointmentDate)
          const emailResult = await sendEmail({
            to: consultation.patient.user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          })

          if (emailResult.success) {
            console.log(`Sent 7d follow-up email to ${consultation.patient.user.email}`)
          } else {
            console.error(`Failed to send email: ${emailResult.error}`)
          }
        }

        // Send SMS if phone number available
        if (consultation.patient.user.phoneNumber) {
          const smsText = smsTemplates.followUp7d(patientName)
          const smsResult = await sendSMS({
            to: consultation.patient.user.phoneNumber,
            body: smsText,
          })

          if (smsResult.success) {
            console.log(`Sent 7d follow-up SMS to ${consultation.patient.user.phoneNumber}`)
          } else {
            console.error(`Failed to send SMS: ${smsResult.error}`)
          }
        }

        // Create notification record
        await prisma.notification.create({
          data: {
            userId: consultation.patient.user.id,
            userRole: 'PATIENT',
            type: 'APPOINTMENT_REMINDER',
            status: 'SENT',
            title: 'Follow-up: How are you feeling?',
            message: `It's been a week since your visit. How are you doing?`,
            data: {
              consultationId: consultation.id,
              appointmentId: consultation.appointmentId,
              type: 'follow-up-7d',
            },
            sentAt: new Date(),
          },
        })

        processed++
      } catch (error: any) {
        console.error(`Error processing consultation ${consultation.id}:`, error)
        errors++
      }
    }

    console.log(`7d follow-up completed: ${processed} processed, ${errors} errors`)
    return { success: true, processed, errors }
  } catch (error: any) {
    console.error('7d follow-up function error:', error)
    throw error
  } finally {
    await closeDatabase()
  }
}

