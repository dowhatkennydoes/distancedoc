#!/bin/bash

# TODO: Deploy Cloud Functions and Cloud Scheduler jobs
# TODO: Set up environment variables
# TODO: Configure schedules
# TODO: Set up IAM permissions

set -e

PROJECT_ID=${GCP_PROJECT_ID:-distancedoc}
REGION=${GCP_REGION:-us-central1}

echo "Deploying Cloud Functions automations..."

# Deploy 24-hour follow-up function
echo "Deploying 24-hour follow-up function..."
gcloud functions deploy followUp24h \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=followUp24h \
  --trigger-topic=follow-up-24h \
  --set-env-vars DATABASE_URL="$DATABASE_URL",SENDGRID_API_KEY="$SENDGRID_API_KEY",TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN",TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER",APP_URL="$NEXT_PUBLIC_APP_URL" \
  --memory=512MB \
  --timeout=540s \
  --max-instances=10

# Deploy 7-day follow-up function
echo "Deploying 7-day follow-up function..."
gcloud functions deploy followUp7d \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=followUp7d \
  --trigger-topic=follow-up-7d \
  --set-env-vars DATABASE_URL="$DATABASE_URL",SENDGRID_API_KEY="$SENDGRID_API_KEY",TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN",TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER",APP_URL="$NEXT_PUBLIC_APP_URL" \
  --memory=512MB \
  --timeout=540s \
  --max-instances=10

# Deploy lab result reminder function
echo "Deploying lab result reminder function..."
gcloud functions deploy labResultReminder \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=labResultReminder \
  --trigger-topic=lab-result-reminder \
  --set-env-vars DATABASE_URL="$DATABASE_URL",SENDGRID_API_KEY="$SENDGRID_API_KEY",TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN",TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER",APP_URL="$NEXT_PUBLIC_APP_URL" \
  --memory=512MB \
  --timeout=540s \
  --max-instances=10

# Deploy medication refill check-in function
echo "Deploying medication refill check-in function..."
gcloud functions deploy medicationRefillCheckin \
  --gen2 \
  --runtime=nodejs20 \
  --region=$REGION \
  --source=./functions \
  --entry-point=medicationRefillCheckin \
  --trigger-topic=medication-refill-checkin \
  --set-env-vars DATABASE_URL="$DATABASE_URL",SENDGRID_API_KEY="$SENDGRID_API_KEY",TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID",TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN",TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER",APP_URL="$NEXT_PUBLIC_APP_URL" \
  --memory=512MB \
  --timeout=540s \
  --max-instances=10

echo "Creating Cloud Scheduler jobs..."

# Create Cloud Scheduler job for 24-hour follow-up (runs daily at 9 AM)
gcloud scheduler jobs create pubsub follow-up-24h-scheduler \
  --location=$REGION \
  --schedule="0 9 * * *" \
  --topic=follow-up-24h \
  --message-body='{"type":"follow-up-24h"}' \
  --time-zone="America/New_York" \
  || echo "Scheduler job may already exist"

# Create Cloud Scheduler job for 7-day follow-up (runs daily at 9 AM)
gcloud scheduler jobs create pubsub follow-up-7d-scheduler \
  --location=$REGION \
  --schedule="0 9 * * *" \
  --topic=follow-up-7d \
  --message-body='{"type":"follow-up-7d"}' \
  --time-zone="America/New_York" \
  || echo "Scheduler job may already exist"

# Create Cloud Scheduler job for lab result reminder (runs daily at 10 AM)
gcloud scheduler jobs create pubsub lab-result-reminder-scheduler \
  --location=$REGION \
  --schedule="0 10 * * *" \
  --topic=lab-result-reminder \
  --message-body='{"type":"lab-result-reminder"}' \
  --time-zone="America/New_York" \
  || echo "Scheduler job may already exist"

# Create Cloud Scheduler job for medication refill check-in (runs daily at 11 AM)
gcloud scheduler jobs create pubsub medication-refill-checkin-scheduler \
  --location=$REGION \
  --schedule="0 11 * * *" \
  --topic=medication-refill-checkin \
  --message-body='{"type":"medication-refill-checkin"}' \
  --time-zone="America/New_York" \
  || echo "Scheduler job may already exist"

echo "✅ Automation deployment complete!"
echo ""
echo "Scheduled jobs:"
echo "  - 24-hour follow-up: Daily at 9 AM"
echo "  - 7-day follow-up: Daily at 9 AM"
echo "  - Lab result reminder: Daily at 10 AM"
echo "  - Medication refill check-in: Daily at 11 AM"

