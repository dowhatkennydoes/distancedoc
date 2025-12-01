#!/bin/bash

# Apply Doctor Dashboard Preview Migration to Supabase
# Migration: 004_add_doctor_dashboard_preview.sql

echo "🚀 Applying Doctor Dashboard Preview Migration..."
echo "=================================================="

# Supabase connection details
SUPABASE_HOST="vhwvejtjrajjsluutrqv.supabase.co"
SUPABASE_PORT="6543"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="\$DistanceDoc2423"

# PostgreSQL connection string
POSTGRES_URL="postgresql://${SUPABASE_USER}:${SUPABASE_PASSWORD}@${SUPABASE_HOST}:${SUPABASE_PORT}/${SUPABASE_DB}"

echo "📄 Reading migration file..."
MIGRATION_FILE="supabase/migrations/004_add_doctor_dashboard_preview.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "✅ Migration file found"
echo "🗄️  Connecting to Supabase database..."

# Apply the migration using psql
if command -v psql &> /dev/null; then
    echo "📋 Executing migration..."
    psql "$POSTGRES_URL" -f "$MIGRATION_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Migration applied successfully!"
        
        # Verify table creation
        echo "🔍 Verifying table creation..."
        psql "$POSTGRES_URL" -c "SELECT COUNT(*) FROM doctor_dashboard_preview;" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Table 'doctor_dashboard_preview' is accessible"
        else
            echo "⚠️  Table verification failed, but migration may have succeeded"
        fi
        
        echo "=================================================="
        echo "🎉 Migration 004 completed successfully!"
    else
        echo "❌ Migration failed"
        exit 1
    fi
else
    echo "❌ psql not found. Please install PostgreSQL client tools"
    echo "📝 Alternative: Copy the following SQL to Supabase Dashboard:"
    echo "   https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new"
    echo ""
    echo "SQL to execute:"
    echo "=============================================="
    cat "$MIGRATION_FILE"
    echo "=============================================="
fi