// TODO: Notification utilities for email and SMS
// TODO: SendGrid email integration
// TODO: Twilio SMS integration
// TODO: Email templates
// TODO: Error handling and retry logic
// TODO: Logging

// @ts-ignore - SendGrid types may not be available
import sgMail from '@sendgrid/mail'
// @ts-ignore - Twilio types may not be available
import twilio from 'twilio'

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

// Initialize Twilio
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

interface SMSOptions {
  to: string
  body: string
  from?: string
}

// TODO: Send email notification
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.warn('SendGrid API key not configured. Email not sent.')
      return { success: false, error: 'SendGrid not configured' }
    }

    const msg = {
      to: options.to,
      from: options.from || process.env.SENDGRID_FROM_EMAIL || 'noreply@distancedoc.com',
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
      html: options.html,
    }

    const [response] = await sgMail.send(msg)
    
    return {
      success: true,
      messageId: response.headers['x-message-id'] as string,
    }
  } catch (error: any) {
    console.error('Email send error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send email',
    }
  }
}

// TODO: Send SMS notification
export async function sendSMS(options: SMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    if (!twilioClient) {
      console.warn('Twilio not configured. SMS not sent.')
      return { success: false, error: 'Twilio not configured' }
    }

    const message = await twilioClient.messages.create({
      body: options.body,
      to: options.to,
      from: options.from || process.env.TWILIO_PHONE_NUMBER || '',
    })

    return {
      success: true,
      messageId: message.sid,
    }
  } catch (error: any) {
    console.error('SMS send error:', error)
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    }
  }
}

// TODO: Email templates
export const emailTemplates = {
  followUp24h: (patientName: string, doctorName: string, appointmentDate: string) => ({
    subject: 'How was your visit?',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DistanceDoc</h1>
            </div>
            <div class="content">
              <h2>Hi ${patientName},</h2>
              <p>We hope you're feeling better after your visit with ${doctorName} on ${appointmentDate}.</p>
              <p>We'd love to hear how you're doing. Please let us know if you have any questions or concerns.</p>
              <a href="${process.env.APP_URL || 'https://distancedoc.com'}/patient/messages" class="button">Send a Message</a>
              <p>If you have any urgent concerns, please contact your doctor directly or call 911 in an emergency.</p>
              <p>Best regards,<br>The DistanceDoc Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  followUp7d: (patientName: string, doctorName: string, appointmentDate: string) => ({
    subject: 'Follow-up: How are you feeling?',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DistanceDoc</h1>
            </div>
            <div class="content">
              <h2>Hi ${patientName},</h2>
              <p>It's been a week since your visit with ${doctorName} on ${appointmentDate}.</p>
              <p>We want to check in and see how you're doing. Are you feeling better? Do you have any questions about your treatment plan?</p>
              <a href="${process.env.APP_URL || 'https://distancedoc.com'}/patient/messages" class="button">Send a Message</a>
              <p>If you need to schedule a follow-up appointment, you can do so from your patient portal.</p>
              <p>Best regards,<br>The DistanceDoc Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  labResultReminder: (patientName: string, labOrderNumber: string, testName: string) => ({
    subject: 'Lab Results Available',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DistanceDoc</h1>
            </div>
            <div class="content">
              <h2>Hi ${patientName},</h2>
              <p>Your lab results for <strong>${testName}</strong> (Order #${labOrderNumber}) are now available.</p>
              <p>You can view your results in your patient portal.</p>
              <a href="${process.env.APP_URL || 'https://distancedoc.com'}/patient/files" class="button">View Lab Results</a>
              <p>If you have any questions about your results, please contact your doctor.</p>
              <p>Best regards,<br>The DistanceDoc Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  medicationRefill: (patientName: string, medicationName: string, daysRemaining: number) => ({
    subject: 'Medication Refill Reminder',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
            .warning { background-color: #fef3c7; padding: 15px; border-radius: 5px; margin: 15px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>DistanceDoc</h1>
            </div>
            <div class="content">
              <h2>Hi ${patientName},</h2>
              <div class="warning">
                <p><strong>Medication Refill Reminder</strong></p>
                <p>Your prescription for <strong>${medicationName}</strong> will run out in approximately ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}.</p>
              </div>
              <p>To ensure you don't run out, please request a refill now.</p>
              <a href="${process.env.APP_URL || 'https://distancedoc.com'}/patient/medications" class="button">Request Refill</a>
              <p>If you have any questions, please contact your doctor.</p>
              <p>Best regards,<br>The DistanceDoc Team</p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
}

// TODO: SMS templates
export const smsTemplates = {
  followUp24h: (patientName: string) =>
    `Hi ${patientName}, we hope you're feeling better after your visit. If you have any questions, please message us in your patient portal. - DistanceDoc`,

  followUp7d: (patientName: string) =>
    `Hi ${patientName}, it's been a week since your visit. How are you feeling? Message us in your patient portal if you have any questions. - DistanceDoc`,

  labResultReminder: (patientName: string, testName: string) =>
    `Hi ${patientName}, your lab results for ${testName} are now available. View them in your patient portal. - DistanceDoc`,

  medicationRefill: (patientName: string, medicationName: string, daysRemaining: number) =>
    `Hi ${patientName}, your ${medicationName} prescription will run out in ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}. Request a refill in your patient portal. - DistanceDoc`,
}

