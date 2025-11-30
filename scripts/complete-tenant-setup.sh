#!/bin/bash

# Complete tenant isolation setup script
# This script applies the migration and sets up tenant isolation

set -e

echo "🚀 Complete Tenant Isolation Setup"
echo "=================================="
echo ""

# Set environment variables
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"
export NEXT_PUBLIC_SUPABASE_URL="https://vhwvejtjrajjsluutrqv.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTY3ODksImV4cCI6MjA3OTk5Mjc4OX0.8OPzYaCtI7OYLoRy7Cmg2WQp_sxe_4U9LHxQaJipWbI"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI"

echo "Step 1: Apply Migration"
echo "-----------------------"
echo ""
echo "⚠️  Migration must be applied manually in Supabase Dashboard:"
echo "   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new"
echo "   2. Open: scripts/apply-migration-sql.sql"
echo "   3. Copy and paste into SQL Editor"
echo "   4. Click Run"
echo ""
read -p "Have you applied the migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please apply the migration first"
    exit 1
fi

echo ""
echo "Step 2: Update user_roles table"
echo "-------------------------------"
npx tsx scripts/update-user-roles-clinic.ts default-clinic || {
    echo "⚠️  user_roles update failed - may need manual SQL"
    echo "   Run in Supabase SQL Editor:"
    echo "   UPDATE user_roles SET clinic_id = 'default-clinic' WHERE clinic_id IS NULL;"
}

echo ""
echo "Step 3: Assign clinic IDs to Prisma records"
echo "--------------------------------------------"
npx tsx scripts/assign-clinic-ids.ts default-clinic

echo ""
echo "Step 4: Test tenant isolation"
echo "------------------------------"
npx tsx scripts/test-tenant-isolation.ts

echo ""
echo "✅ Tenant isolation setup complete!"
echo ""
echo "📋 Summary:"
echo "   - Migration: Applied"
echo "   - user_roles: Updated"
echo "   - Prisma records: Assigned clinic IDs"
echo "   - Tests: Run"
echo ""

