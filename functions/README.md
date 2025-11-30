# Google Cloud Functions

This directory contains Cloud Functions for scheduled tasks and HTTP endpoints.

## Functions

### Scheduled Functions (Cloud Scheduler)
- `appointment-reminders.ts` - Send appointment reminders via email/SMS
- `subscription-renewals.ts` - Process subscription renewals via Stripe
- `data-cleanup.ts` - Clean up old data and archive records

### HTTP Functions
- `stripe-webhook.ts` - Handle Stripe webhook events
- `email-notifications.ts` - Send email notifications

## Deployment

```bash
cd functions
npm install
gcloud functions deploy FUNCTION_NAME --runtime nodejs20 --trigger-http
```

## TODO

- Add function deployment scripts
- Configure environment variables
- Set up Cloud Scheduler jobs
- Add monitoring and logging
- Implement error alerting

