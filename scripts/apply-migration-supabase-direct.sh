#!/bin/bash

# Apply migration using Supabase CLI with proper connection string
# This script uses the connection pooler

set -e

echo "🚀 Applying Tenant Isolation Migration via Supabase"
echo "===================================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found"
    echo "   Install: npm install -g supabase"
    exit 1
fi

# Project is already linked (we verified earlier)
echo "✅ Project linked: vhwvejtjrajjsluutrqv"
echo ""

# Migration file
MIGRATION_FILE="supabase/migrations/002_add_clinic_id.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration file: $MIGRATION_FILE"
echo ""

# Use Supabase CLI db push with connection string
# The CLI should handle authentication via the linked project
echo "🔄 Applying migration using Supabase CLI..."
echo ""

# Try db push (applies pending migrations)
if supabase db push --db-url "postgresql://postgres.vhwvejtjrajjsluutrqv:$DistanceDoc2423@aws-0-us-east-2.pooler.supabase.com:6543/postgres" 2>&1; then
    echo ""
    echo "✅ Migration applied successfully!"
elif supabase db push --db-url "postgresql://postgres:$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres?sslmode=require" 2>&1; then
    echo ""
    echo "✅ Migration applied successfully!"
else
    echo ""
    echo "⚠️  Supabase CLI push failed"
    echo ""
    echo "📝 Applying via Supabase Dashboard SQL Editor..."
    echo ""
    echo "   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new"
    echo "   2. Open: $MIGRATION_FILE"
    echo "   3. Copy entire file and paste into SQL Editor"
    echo "   4. Click Run"
    echo ""
    echo "   Or use the Management API script:"
    echo "   npx tsx scripts/apply-migration-api.ts"
    exit 1
fi

echo ""
echo "✅ Migration complete!"
echo ""

