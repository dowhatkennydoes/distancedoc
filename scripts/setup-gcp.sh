#!/bin/bash

# DistanceDoc GCP Setup Script
# This script sets up all required GCP resources for DistanceDoc

set -e

PROJECT_ID="distancedoc"
PROJECT_NUMBER="1060519861866"
REGION="us-central1"
ZONE="${REGION}-a"

echo "🚀 Setting up GCP resources for DistanceDoc..."
echo "Project ID: $PROJECT_ID"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI is not installed. Please install it first:"
    echo "   brew install google-cloud-sdk"
    exit 1
fi

# Set the project
echo "📋 Setting GCP project..."
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "🔌 Enabling required GCP APIs..."
gcloud services enable \
    cloudfunctions.googleapis.com \
    cloudsql.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com \
    aiplatform.googleapis.com \
    speech.googleapis.com \
    cloudscheduler.googleapis.com \
    logging.googleapis.com \
    run.googleapis.com \
    compute.googleapis.com

echo "✅ APIs enabled"
echo ""

# Create Cloud Storage bucket
BUCKET_NAME="${PROJECT_ID}-uploads"
echo "🪣 Creating Cloud Storage bucket: $BUCKET_NAME..."
if gsutil ls -b gs://$BUCKET_NAME &> /dev/null; then
    echo "   Bucket already exists, skipping..."
else
    gsutil mb -p $PROJECT_ID -c STANDARD -l $REGION gs://$BUCKET_NAME
    echo "   ✅ Bucket created"
fi

# Set bucket CORS for direct browser uploads
echo "   Setting CORS configuration..."
cat > /tmp/cors.json << EOF
[
  {
    "origin": ["*"],
    "method": ["GET", "PUT", "POST", "HEAD"],
    "responseHeader": ["Content-Type", "Access-Control-Allow-Origin"],
    "maxAgeSeconds": 3600
  }
]
EOF
gsutil cors set /tmp/cors.json gs://$BUCKET_NAME
rm /tmp/cors.json
echo "   ✅ CORS configured"
echo ""

# Create Cloud SQL instance
INSTANCE_NAME="${PROJECT_ID}-db"
DB_NAME="distancedoc"
DB_USER="postgres"
echo "🗄️  Creating Cloud SQL PostgreSQL instance: $INSTANCE_NAME..."
if gcloud sql instances describe $INSTANCE_NAME &> /dev/null; then
    echo "   Instance already exists, skipping..."
else
    gcloud sql instances create $INSTANCE_NAME \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --root-password=$(openssl rand -base64 32) \
        --storage-type=SSD \
        --storage-size=20GB \
        --backup-start-time=03:00 \
        --enable-bin-log
    
    echo "   ✅ Instance created"
    echo "   ⚠️  Note: Root password was generated. Store it securely!"
fi

# Create database
echo "   Creating database: $DB_NAME..."
gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME 2>/dev/null || echo "   Database may already exist"
echo "   ✅ Database ready"
echo ""

# Initialize Firestore
echo "🔥 Initializing Firestore..."
if gcloud firestore databases list --format="value(name)" | grep -q "default"; then
    echo "   Firestore already initialized, skipping..."
else
    gcloud firestore databases create \
        --location=$REGION \
        --type=firestore-native
    echo "   ✅ Firestore initialized"
fi
echo ""

# Create service account for Cloud Functions
SERVICE_ACCOUNT_NAME="distancedoc-functions"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo "👤 Creating service account: $SERVICE_ACCOUNT_NAME..."
if gcloud iam service-accounts describe $SERVICE_ACCOUNT_EMAIL &> /dev/null; then
    echo "   Service account already exists, skipping..."
else
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
        --display-name="DistanceDoc Cloud Functions Service Account"
    echo "   ✅ Service account created"
fi

# Grant necessary permissions
echo "   Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/cloudsql.client" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/storage.objectAdmin" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/datastore.user" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/aiplatform.user" \
    --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
    --role="roles/logging.logWriter" \
    --condition=None

echo "   ✅ Permissions granted"
echo ""

# Create service account key
KEY_FILE="service-account-key.json"
echo "🔑 Creating service account key..."
if [ -f "$KEY_FILE" ]; then
    echo "   Key file already exists, skipping..."
else
    gcloud iam service-accounts keys create $KEY_FILE \
        --iam-account=$SERVICE_ACCOUNT_EMAIL
    echo "   ✅ Key created: $KEY_FILE"
    echo "   ⚠️  IMPORTANT: Add this to .env as GCP_SERVICE_ACCOUNT (base64 encoded)"
    echo "   Run: cat $KEY_FILE | base64"
fi
echo ""

# Get Cloud SQL connection name
CONNECTION_NAME=$(gcloud sql instances describe $INSTANCE_NAME --format="value(connectionName)")
echo "📝 Configuration Summary:"
echo ""
echo "=========================================="
echo "GCP Setup Complete!"
echo "=========================================="
echo ""
echo "Add these to your .env file:"
echo ""
echo "GCP_PROJECT_ID=$PROJECT_ID"
echo "GCP_PROJECT_NUMBER=$PROJECT_NUMBER"
echo "GCP_REGION=$REGION"
echo "GCP_SQL_INSTANCE=$INSTANCE_NAME"
echo "GCP_SQL_DATABASE=$DB_NAME"
echo "GCP_SQL_USER=$DB_USER"
echo "GCP_STORAGE_BUCKET=$BUCKET_NAME"
echo "GCP_FIREBASE_CONFIG={\"projectId\":\"$PROJECT_ID\"}"
echo ""
echo "Cloud SQL Connection Name: $CONNECTION_NAME"
echo "Use this in DATABASE_URL:"
echo "postgresql://$DB_USER:PASSWORD@/$DB_NAME?host=/cloudsql/$CONNECTION_NAME"
echo ""
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Key file: $KEY_FILE"
echo ""
echo "Next steps:"
echo "1. Get the Cloud SQL root password: gcloud sql users list --instance=$INSTANCE_NAME"
echo "2. Create a database user: gcloud sql users create app_user --instance=$INSTANCE_NAME --password=YOUR_PASSWORD"
echo "3. Encode service account key: cat $KEY_FILE | base64"
echo "4. Add the base64 string to .env as GCP_SERVICE_ACCOUNT"
echo "5. Run: npm run db:push (after setting up Prisma)"
echo ""

