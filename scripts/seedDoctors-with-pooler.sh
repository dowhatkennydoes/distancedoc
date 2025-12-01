#!/bin/bash
# Run seedDoctors script with connection pooler URL

export NEXT_PUBLIC_SUPABASE_URL="https://vhwvejtjrajjsluutrqv.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI"
export DATABASE_URL="postgresql://postgres.vhwvejtjrajjsluutrqv:\$DistanceDoc2423@aws-1-us-east-2.pooler.supabase.com:5432/postgres?pgbouncer=true"
export DATABASE_PASSWORD='$DistanceDoc2423'

echo "🚀 Running seedDoctors script with connection pooler..."
echo ""
echo "Environment configured:"
echo "  - Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "  - Database: Supabase Connection Pooler"
echo ""

npx tsx scripts/seedDoctors.ts

