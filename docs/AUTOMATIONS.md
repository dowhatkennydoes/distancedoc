# Cloud Scheduler + Cloud Functions Automations

## Overview

Automated notification system using Google Cloud Scheduler and Cloud Functions to send follow-up messages, lab result reminders, and medication refill check-ins.

## Automations

### 1. 24-Hour Follow-Up Message

**Schedule**: Daily at 9:00 AM  
**Function**: `followUp24h`

**Purpose**: Send follow-up messages to patients 24 hours after their consultation ends.

**Logic**:
- Queries consultations completed 24 hours ago (within 1-hour window)
- Checks if follow-up already sent
- Sends email and SMS (if phone available)
- Creates notification record

**Query**:
```sql
SELECT * FROM consultations
WHERE status = 'COMPLETED'
  AND ended_at >= NOW() - INTERVAL '25 hours'
  AND ended_at <= NOW() - INTERVAL '24 hours'
```

### 2. 7-Day Follow-Up Message

**Schedule**: Daily at 9:00 AM  
**Function**: `followUp7d`

**Purpose**: Send follow-up messages to patients 7 days after their consultation ends.

**Logic**:
- Queries consultations completed 7 days ago (within 1-day window)
- Checks if follow-up already sent
- Sends email and SMS (if phone available)
- Creates notification record

**Query**:
```sql
SELECT * FROM consultations
WHERE status = 'COMPLETED'
  AND ended_at >= NOW() - INTERVAL '8 days'
  AND ended_at <= NOW() - INTERVAL '7 days'
```

### 3. Lab Result Reminder

**Schedule**: Daily at 10:00 AM  
**Function**: `labResultReminder`

**Purpose**: Remind patients when lab results are available but not yet viewed.

**Logic**:
- Queries lab orders with status `RESULTS_READY`
- Results available for at least 24 hours
- Checks if reminder already sent
- Sends email and SMS (if phone available)
- Creates notification record

**Query**:
```sql
SELECT * FROM lab_orders
WHERE status = 'RESULTS_READY'
  AND results IS NOT NULL
  AND updated_at <= NOW() - INTERVAL '1 day'
```

### 4. Medication Refill Check-In

**Schedule**: Daily at 11:00 AM  
**Function**: `medicationRefillCheckin`

**Purpose**: Remind patients when medications are running low and need refills.

**Logic**:
- Queries active medications
- Calculates days remaining based on end date or typical 30-day supply
- Only sends reminder if 7 days or less remaining
- Checks if reminder already sent (within 7 days)
- Sends email and SMS (if phone available)
- Creates notification record

**Query**:
```sql
SELECT * FROM medications
WHERE status = 'ACTIVE'
```

## Notification Channels

### Email (SendGrid)

- HTML email templates
- Responsive design
- Action buttons linking to patient portal
- Professional branding

### SMS (Twilio)

- Concise messages (160 characters)
- Links to patient portal
- Clear call-to-action

## Deployment

### Prerequisites

1. **Environment Variables**:
   ```bash
   DATABASE_URL=postgresql://...
   SENDGRID_API_KEY=SG...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1234567890
   APP_URL=https://distancedoc.com
   ```

2. **GCP Setup**:
   - Cloud Functions API enabled
   - Cloud Scheduler API enabled
   - Pub/Sub API enabled
   - Service account with proper permissions

### Deploy Functions

```bash
chmod +x scripts/deploy-automations.sh
./scripts/deploy-automations.sh
```

### Manual Deployment

```bash
# Deploy 24-hour follow-up
gcloud functions deploy followUp24h \
  --gen2 \
  --runtime=nodejs20 \
  --region=us-central1 \
  --source=./functions \
  --entry-point=followUp24h \
  --trigger-topic=follow-up-24h

# Create scheduler job
gcloud scheduler jobs create pubsub follow-up-24h-scheduler \
  --location=us-central1 \
  --schedule="0 9 * * *" \
  --topic=follow-up-24h \
  --message-body='{"type":"follow-up-24h"}'
```

## Monitoring

### View Logs

```bash
# View function logs
gcloud functions logs read followUp24h --region=us-central1

# View scheduler job history
gcloud scheduler jobs describe follow-up-24h-scheduler --location=us-central1
```

### Metrics

- **Processed**: Number of notifications sent successfully
- **Errors**: Number of failed notifications
- **Success Rate**: Processed / (Processed + Errors)

## Error Handling

- **Retry Logic**: Cloud Scheduler retries failed jobs
- **Dead Letter Queue**: Failed messages can be sent to DLQ
- **Logging**: All errors logged to Cloud Logging
- **Notification Records**: Failed notifications marked as `FAILED`

## Testing

### Local Testing

```typescript
import { followUp24h } from './functions/src/scheduled/follow-up-24h'

// Mock CloudEvent
const event = {
  data: { type: 'follow-up-24h' },
}

await followUp24h(event)
```

### Manual Trigger

```bash
# Trigger function manually
gcloud scheduler jobs run follow-up-24h-scheduler --location=us-central1
```

## Customization

### Modify Schedules

Edit Cloud Scheduler jobs:
```bash
gcloud scheduler jobs update pubsub follow-up-24h-scheduler \
  --schedule="0 10 * * *"  # Change to 10 AM
```

### Modify Templates

Edit email/SMS templates in:
- `functions/src/lib/notifications.ts`

### Add New Automations

1. Create new function in `functions/src/scheduled/`
2. Export from `functions/src/index.ts`
3. Deploy function
4. Create Cloud Scheduler job

## Security

- ✅ Authentication required for database access
- ✅ Environment variables encrypted at rest
- ✅ IAM roles with least privilege
- ✅ No sensitive data in logs
- ✅ HIPAA-compliant notification handling

## Cost Optimization

- **Batch Processing**: Process multiple notifications per run
- **Deduplication**: Skip already-sent notifications
- **Efficient Queries**: Indexed database queries
- **Function Timeout**: 540s (9 minutes) max
- **Memory**: 512MB per function

## Troubleshooting

### Function Not Triggering

1. Check Cloud Scheduler job status
2. Verify Pub/Sub topic exists
3. Check function logs for errors
4. Verify IAM permissions

### Notifications Not Sending

1. Check SendGrid/Twilio API keys
2. Verify email/phone numbers are valid
3. Check function logs for errors
4. Verify database connection

### Duplicate Notifications

1. Check notification deduplication logic
2. Verify database queries are correct
3. Check for race conditions

