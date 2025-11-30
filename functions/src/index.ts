// Export all Cloud Functions
// Configure function deployment settings (memory, timeout, region)
// Set up environment variables
// Add error handling middleware
// Configure CORS for HTTP functions

// Import and export scheduled functions
export { followUp24h } from './scheduled/follow-up-24h'
export { followUp7d } from './scheduled/follow-up-7d'
export { labResultReminder } from './scheduled/lab-result-reminder'
export { medicationRefillCheckin } from './scheduled/medication-refill-checkin'

// TODO: Import and export HTTP functions
// export { stripeWebhook } from './http/stripe-webhook'
// export { emailNotifications } from './http/email-notifications'

