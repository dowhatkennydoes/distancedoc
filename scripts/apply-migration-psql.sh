#!/bin/bash

# Apply tenant isolation migration using psql directly
# This bypasses Supabase CLI authentication issues

set -e

echo "🚀 Applying Tenant Isolation Migration via psql"
echo "================================================"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ psql not found. Please install PostgreSQL client tools."
    exit 1
fi

# Connection details
DB_HOST="db.vhwvejtjrajjsluutrqv.supabase.co"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"
DB_PASSWORD='$DistanceDoc2423'

# Migration file
MIGRATION_FILE="supabase/migrations/002_add_clinic_id.sql"

# Check migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration file: $MIGRATION_FILE"
echo "🔗 Connecting to: $DB_HOST"
echo ""

# Set PGPASSWORD environment variable
export PGPASSWORD="$DB_PASSWORD"

# Apply migration
echo "🔄 Applying migration..."
echo ""

if psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -f "$MIGRATION_FILE" \
    -v ON_ERROR_STOP=1; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    
    # Verify migration
    echo "🔍 Verifying migration..."
    psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT 
              'user_roles' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'clinic_id') as has_clinic_id
            UNION ALL
            SELECT 
              'doctors' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'clinic_id') as has_clinic_id
            UNION ALL
            SELECT 
              'patients' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'clinic_id') as has_clinic_id
            UNION ALL
            SELECT 
              'appointments' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'clinic_id') as has_clinic_id
            UNION ALL
            SELECT 
              'visit_notes' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'visit_notes' AND column_name = 'clinic_id') as has_clinic_id
            UNION ALL
            SELECT 
              'message_threads' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'message_threads' AND column_name = 'clinic_id') as has_clinic_id;" || {
        echo "⚠️  Could not verify migration, but it may have been applied"
    }
    
    echo ""
    echo "✅ Migration complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Run: npm run update:user-roles"
    echo "   2. Run: npm run assign:clinics"
    echo "   3. Run: npm run test:tenant"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo ""
    echo "💡 Troubleshooting:"
    echo "   - Check database connection"
    echo "   - Verify password is correct"
    echo "   - Ensure network access to Supabase"
    exit 1
fi

# Clear password from environment
unset PGPASSWORD

