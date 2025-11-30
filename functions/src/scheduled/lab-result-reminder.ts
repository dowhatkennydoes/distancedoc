// TODO: Lab result reminder automation
// TODO: Triggered by Cloud Scheduler (runs daily)
// TODO: Query lab orders with results ready but not viewed
// TODO: Send reminder email/SMS to patients
// TODO: Create notification records
// TODO: Handle errors and retries

import { CloudEvent } from '@google-cloud/functions-framework'
import { getPrismaClient, closeDatabase } from '../lib/database'
import { sendEmail, sendSMS, emailTemplates, smsTemplates } from '../lib/notifications'

export const labResultReminder = async (cloudEvent: CloudEvent) => {
  const prisma = getPrismaClient()
  let processed = 0
  let errors = 0

  try {
    // Query lab orders with results ready (status = RESULTS_READY)
    // and results were added more than 24 hours ago but not yet viewed
    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const labOrders = await prisma.labOrder.findMany({
      where: {
        status: 'RESULTS_READY',
        results: {
          not: null,
        },
        updatedAt: {
          lte: oneDayAgo, // Results have been available for at least 24 hours
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
      },
    })

    console.log(`Found ${labOrders.length} lab orders with results ready`)

    // Process each lab order
    for (const labOrder of labOrders) {
      try {
        // Check if we already sent a reminder for this lab order
        // Note: Prisma doesn't support JSON path queries directly, so we'll check by type and message
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: labOrder.patient.user.id,
            type: 'LAB_RESULTS_READY',
            message: {
              contains: labOrder.orderNumber,
            },
            createdAt: {
              gte: oneDayAgo,
            },
          },
        })

        if (existingNotification) {
          console.log(`Skipping lab order ${labOrder.id} - already notified`)
          continue
        }

        const patientName = `${labOrder.patient.user.firstName || ''} ${labOrder.patient.user.lastName || ''}`.trim() || 'Patient'
        const testNames = labOrder.tests.join(', ')

        // Send email
        if (labOrder.patient.user.email) {
          const emailTemplate = emailTemplates.labResultReminder(
            patientName,
            labOrder.orderNumber,
            testNames
          )
          const emailResult = await sendEmail({
            to: labOrder.patient.user.email,
            subject: emailTemplate.subject,
            html: emailTemplate.html,
          })

          if (emailResult.success) {
            console.log(`Sent lab result reminder email to ${labOrder.patient.user.email}`)
          } else {
            console.error(`Failed to send email: ${emailResult.error}`)
          }
        }

        // Send SMS if phone number available
        if (labOrder.patient.user.phoneNumber) {
          const smsText = smsTemplates.labResultReminder(patientName, testNames)
          const smsResult = await sendSMS({
            to: labOrder.patient.user.phoneNumber,
            body: smsText,
          })

          if (smsResult.success) {
            console.log(`Sent lab result reminder SMS to ${labOrder.patient.user.phoneNumber}`)
          } else {
            console.error(`Failed to send SMS: ${smsResult.error}`)
          }
        }

        // Create notification record
        await prisma.notification.create({
          data: {
            userId: labOrder.patient.user.id,
            userRole: 'PATIENT',
            type: 'LAB_RESULTS_READY',
            status: 'SENT',
            title: 'Lab Results Available',
            message: `Your lab results for ${testNames} are now available.`,
            data: {
              labOrderId: labOrder.id,
              orderNumber: labOrder.orderNumber,
              tests: labOrder.tests,
            },
            sentAt: new Date(),
          },
        })

        processed++
      } catch (error: any) {
        console.error(`Error processing lab order ${labOrder.id}:`, error)
        errors++
      }
    }

    console.log(`Lab result reminder completed: ${processed} processed, ${errors} errors`)
    return { success: true, processed, errors }
  } catch (error: any) {
    console.error('Lab result reminder function error:', error)
    throw error
  } finally {
    await closeDatabase()
  }
}

