# GCP Setup Guide for DistanceDoc

This guide walks you through setting up all required Google Cloud Platform resources for DistanceDoc.

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud SDK** installed and authenticated
3. **Project ID**: `distancedoc`
4. **Project Number**: `1060519861866`

## Quick Setup (Automated)

Run the setup script:

```bash
chmod +x scripts/setup-gcp.sh
./scripts/setup-gcp.sh
```

This script will:
- Enable all required GCP APIs
- Create Cloud Storage bucket
- Create Cloud SQL PostgreSQL instance
- Initialize Firestore
- Create service account with proper permissions
- Generate service account key

## Manual Setup

### 1. Authenticate and Set Project

```bash
gcloud auth login
gcloud config set project distancedoc
```

### 2. Enable Required APIs

```bash
gcloud services enable \
    cloudfunctions.googleapis.com \
    cloudsql.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com \
    aiplatform.googleapis.com \
    speech.googleapis.com \
    cloudscheduler.googleapis.com \
    logging.googleapis.com \
    run.googleapis.com
```

### 3. Create Cloud Storage Bucket

```bash
gsutil mb -p distancedoc -c STANDARD -l us-central1 gs://distancedoc-uploads

# Set CORS for direct browser uploads
cat > cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set cors.json gs://distancedoc-uploads
```

### 4. Create Cloud SQL PostgreSQL Instance

```bash
gcloud sql instances create distancedoc-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --root-password=YOUR_SECURE_PASSWORD \
    --storage-type=SSD \
    --storage-size=20GB \
    --backup-start-time=03:00 \
    --enable-bin-log

# Create database
gcloud sql databases create distancedoc --instance=distancedoc-db

# Create application user (recommended)
gcloud sql users create app_user \
    --instance=distancedoc-db \
    --password=YOUR_APP_PASSWORD
```

**Get Connection Name:**
```bash
gcloud sql instances describe distancedoc-db --format="value(connectionName)"
```

### 5. Initialize Firestore

```bash
gcloud firestore databases create \
    --location=us-central1 \
    --type=firestore-native
```

**Note:** Firestore can only be initialized once per project. Choose `firestore-native` mode for better scalability.

### 6. Create Service Account

```bash
# Create service account
gcloud iam service-accounts create distancedoc-functions \
    --display-name="DistanceDoc Cloud Functions Service Account"

# Grant permissions
gcloud projects add-iam-policy-binding distancedoc \
    --member="serviceAccount:distancedoc-functions@distancedoc.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding distancedoc \
    --member="serviceAccount:distancedoc-functions@distancedoc.iam.gserviceaccount.com" \
    --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding distancedoc \
    --member="serviceAccount:distancedoc-functions@distancedoc.iam.gserviceaccount.com" \
    --role="roles/datastore.user"

gcloud projects add-iam-policy-binding distancedoc \
    --member="serviceAccount:distancedoc-functions@distancedoc.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding distancedoc \
    --member="serviceAccount:distancedoc-functions@distancedoc.iam.gserviceaccount.com" \
    --role="roles/logging.logWriter"
```

### 7. Generate Service Account Key

```bash
gcloud iam service-accounts keys create service-account-key.json \
    --iam-account=distancedoc-functions@distancedoc.iam.gserviceaccount.com

# Encode to base64 for .env file
cat service-account-key.json | base64
```

**⚠️ Security Note:** Never commit `service-account-key.json` to version control. Add it to `.gitignore`.

## Environment Variables

After setup, add these to your `.env` file:

```bash
# GCP Configuration
GCP_PROJECT_ID=distancedoc
GCP_PROJECT_NUMBER=1060519861866
GCP_REGION=us-central1

# Cloud SQL
GCP_SQL_INSTANCE=distancedoc-db
GCP_SQL_DATABASE=distancedoc
GCP_SQL_USER=app_user
GCP_SQL_PASSWORD=YOUR_APP_PASSWORD
DATABASE_URL="postgresql://app_user:YOUR_APP_PASSWORD@/distancedoc?host=/cloudsql/distancedoc:us-central1:distancedoc-db"

# Cloud Storage
GCP_STORAGE_BUCKET=distancedoc-uploads

# Firestore
GCP_FIREBASE_CONFIG={"projectId":"distancedoc"}

# Service Account (base64 encoded)
GCP_SERVICE_ACCOUNT=<base64_encoded_service_account_json>

# Cloud Logging
GCP_LOG_NAME=distancedoc
```

## Verify Setup

### Check APIs
```bash
gcloud services list --enabled
```

### Check Cloud SQL
```bash
gcloud sql instances list
gcloud sql databases list --instance=distancedoc-db
```

### Check Storage
```bash
gsutil ls gs://distancedoc-uploads
```

### Check Firestore
```bash
gcloud firestore databases list
```

### Check Service Account
```bash
gcloud iam service-accounts list
gcloud iam service-accounts get-iam-policy distancedoc-functions@distancedoc.iam.gserviceaccount.com
```

## Next Steps

1. **Set up Prisma:**
   ```bash
   npm run db:generate
   npm run db:push
   ```

2. **Test Cloud Storage:**
   ```bash
   # Test upload
   echo "test" > test.txt
   gsutil cp test.txt gs://distancedoc-uploads/
   ```

3. **Deploy Cloud Functions:**
   ```bash
   cd functions
   npm install
   gcloud functions deploy appointmentReminders --runtime nodejs20 --trigger-http
   ```

4. **Set up Cloud Scheduler:**
   ```bash
   gcloud scheduler jobs create http appointment-reminders \
       --schedule="0 9 * * *" \
       --uri="https://REGION-PROJECT_ID.cloudfunctions.net/appointmentReminders" \
       --http-method=POST
   ```

## Troubleshooting

### Cloud SQL Connection Issues

**Local Development:**
- Use Cloud SQL Proxy: `cloud-sql-proxy distancedoc:us-central1:distancedoc-db`
- Update `DATABASE_URL` to use `127.0.0.1:5432`

**Cloud Functions:**
- Ensure service account has `roles/cloudsql.client`
- Use Unix socket path: `/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`

### Firestore Not Initialized

Firestore can only be initialized once. If you see an error, check if it's already initialized:
```bash
gcloud firestore databases list
```

### Service Account Permissions

If you get permission errors, verify roles:
```bash
gcloud projects get-iam-policy distancedoc \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:distancedoc-functions@distancedoc.iam.gserviceaccount.com"
```

### Vertex AI Access

Ensure Vertex AI API is enabled and you have access:
```bash
gcloud services enable aiplatform.googleapis.com
gcloud auth application-default login
```

## Cost Estimation

Approximate monthly costs (varies by usage):

- **Cloud SQL (db-f1-micro)**: ~$7-10/month
- **Cloud Storage (20GB)**: ~$0.50/month
- **Firestore**: Free tier (50K reads, 20K writes/day)
- **Cloud Functions**: Pay per invocation
- **Vertex AI**: Pay per API call
- **Cloud Logging**: First 50GB free

**Total estimated**: ~$10-20/month for development/testing

## Security Best Practices

1. ✅ Use service accounts instead of user accounts
2. ✅ Rotate service account keys regularly
3. ✅ Use least privilege principle for IAM roles
4. ✅ Enable Cloud SQL SSL connections
5. ✅ Set up VPC firewall rules
6. ✅ Enable Cloud SQL backups
7. ✅ Use Cloud KMS for sensitive data encryption
8. ✅ Enable audit logging

## Support

For issues or questions:
- Check [GCP Documentation](https://cloud.google.com/docs)
- Review [DistanceDoc README](../README.md)
- Check service-specific documentation in `lib/gcp/README.md`

