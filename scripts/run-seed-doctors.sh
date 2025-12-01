#!/bin/bash
# Run seedDoctors script with Supabase credentials

export NEXT_PUBLIC_SUPABASE_URL="https://vhwvejtjrajjsluutrqv.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI"
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"

echo "🚀 Running seedDoctors script..."
echo ""
echo "Environment configured:"
echo "  - Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "  - Database: Supabase PostgreSQL"
echo ""

npx tsx scripts/seedDoctors.ts

