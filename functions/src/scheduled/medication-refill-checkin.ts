// TODO: Medication refill check-in automation
// TODO: Triggered by Cloud Scheduler (runs daily)
// TODO: Query active medications approaching refill date
// TODO: Calculate days remaining based on startDate, endDate, and refills
// TODO: Send reminder email/SMS to patients
// TODO: Create notification records
// TODO: Handle errors and retries

import { CloudEvent } from '@google-cloud/functions-framework'
import { getPrismaClient, closeDatabase } from '../lib/database'
import { sendEmail, sendSMS, emailTemplates, smsTemplates } from '../lib/notifications'

export const medicationRefillCheckin = async (cloudEvent: CloudEvent) => {
  const prisma = getPrismaClient()
  let processed = 0
  let errors = 0

  try {
    // Query active medications
    const activeMedications = await prisma.medication.findMany({
      where: {
        status: 'ACTIVE',
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
      },
    })

    console.log(`Found ${activeMedications.length} active medications to check`)

    // Process each medication
    for (const medication of activeMedications) {
      try {
        // Calculate days remaining
        // This is a simplified calculation - in production, you'd need more complex logic
        // based on dosage, frequency, quantity, and refills
        let daysRemaining: number | null = null

        if (medication.endDate) {
          const now = new Date()
          const endDate = new Date(medication.endDate)
          const diffTime = endDate.getTime() - now.getTime()
          daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        } else if (medication.startDate) {
          // If no end date, estimate based on typical 30-day supply
          const startDate = new Date(medication.startDate)
          const now = new Date()
          const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
          const typicalSupplyDays = 30
          daysRemaining = typicalSupplyDays - (daysSinceStart % typicalSupplyDays)
        }

        // Only send reminder if medication is running low (7 days or less remaining)
        if (daysRemaining === null || daysRemaining > 7) {
          continue
        }

        // Check if we already sent a reminder for this medication recently
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: medication.patient.user.id,
            type: 'SYSTEM_ALERT',
            title: 'Medication Refill Reminder',
            message: {
              contains: medication.name,
            },
            createdAt: {
              gte: oneWeekAgo,
            },
          },
        })

        if (existingNotification) {
          console.log(`Skipping medication ${medication.id} - already notified`)
          continue
        }

        const patientName = `${medication.patient.user.firstName || ''} ${medication.patient.user.lastName || ''}`.trim() || 'Patient'

        // Send email
        if (medication.patient.user.email) {
          const emailTemplate = emailTemplates.medicationRefill(
            patientName,
            medication.name,
            daysRemaining
          )
          const emailResult = await sendEmail({
            to: medication.patient.user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          })

          if (emailResult.success) {
            console.log(`Sent medication refill reminder email to ${medication.patient.user.email}`)
          } else {
            console.error(`Failed to send email: ${emailResult.error}`)
          }
        }

        // Send SMS if phone number available
        if (medication.patient.user.phoneNumber) {
          const smsText = smsTemplates.medicationRefill(patientName, medication.name, daysRemaining)
          const smsResult = await sendSMS({
            to: medication.patient.user.phoneNumber,
            body: smsText,
          })

          if (smsResult.success) {
            console.log(`Sent medication refill reminder SMS to ${medication.patient.user.phoneNumber}`)
          } else {
            console.error(`Failed to send SMS: ${smsResult.error}`)
          }
        }

        // Create notification record
        await prisma.notification.create({
          data: {
            userId: medication.patient.user.id,
            userRole: 'PATIENT',
            type: 'SYSTEM_ALERT',
            status: 'SENT',
            title: 'Medication Refill Reminder',
            message: `Your ${medication.name} prescription will run out in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.`,
            data: {
              medicationId: medication.id,
              medicationName: medication.name,
              daysRemaining,
            },
            sentAt: new Date(),
          },
        })

        processed++
      } catch (error: any) {
        console.error(`Error processing medication ${medication.id}:`, error)
        errors++
      }
    }

    console.log(`Medication refill check-in completed: ${processed} processed, ${errors} errors`)
    return { success: true, processed, errors }
  } catch (error: any) {
    console.error('Medication refill check-in function error:', error)
    throw error
  } finally {
    await closeDatabase()
  }
}

