#!/bin/bash

# Apply migration using Supabase credentials
# Uses SSL connection with proper connection string

set -e

echo "🚀 Applying Tenant Isolation Migration"
echo "======================================="
echo ""

# Credentials
DB_PASSWORD='$DistanceDoc2423'
PROJECT_REF="vhwvejtjrajjsluutrqv"

# Connection string with SSL
# Using the direct connection (not pooler) with SSL
CONNECTION_STRING="postgresql://postgres:${DB_PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres?sslmode=require"

# Migration file
MIGRATION_FILE="supabase/migrations/002_add_clinic_id.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📋 Migration file: $MIGRATION_FILE"
echo "🔗 Project: $PROJECT_REF"
echo ""

# Check if psql is available
if command -v psql &> /dev/null; then
    echo "🔄 Applying migration via psql with SSL..."
    echo ""
    
    export PGPASSWORD="$DB_PASSWORD"
    
    if psql "$CONNECTION_STRING" -f "$MIGRATION_FILE" -v ON_ERROR_STOP=1 2>&1; then
        echo ""
        echo "✅ Migration applied successfully!"
        
        # Verify
        echo ""
        echo "🔍 Verifying migration..."
        psql "$CONNECTION_STRING" -c "
            SELECT 
              'user_roles' as table_name,
              EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'clinic_id') as has_clinic_id
            UNION ALL
            SELECT 'doctors', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'doctors' AND column_name = 'clinic_id')
            UNION ALL
            SELECT 'patients', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'clinic_id')
            UNION ALL
            SELECT 'appointments', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'appointments' AND column_name = 'clinic_id')
            UNION ALL
            SELECT 'visit_notes', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'visit_notes' AND column_name = 'clinic_id')
            UNION ALL
            SELECT 'message_threads', EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'message_threads' AND column_name = 'clinic_id');
        " 2>&1 || echo "⚠️  Verification query failed, but migration may have succeeded"
        
        unset PGPASSWORD
        
        echo ""
        echo "✅ Migration complete!"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Run: npm run update:user-roles"
        echo "   2. Run: npm run assign:clinics"
        echo "   3. Run: npm run test:tenant"
        echo ""
        exit 0
    else
        echo ""
        echo "❌ psql migration failed"
        unset PGPASSWORD
    fi
fi

# Fallback: Try Supabase CLI
if command -v supabase &> /dev/null; then
    echo "🔄 Trying Supabase CLI..."
    echo ""
    
    # Ensure project is linked
    if [ ! -f "supabase/.temp/project-ref" ]; then
        echo "📋 Linking project..."
        echo "$PROJECT_REF" > supabase/.temp/project-ref 2>/dev/null || true
    fi
    
    # Try db push
    if supabase db push --db-url "$CONNECTION_STRING" 2>&1; then
        echo ""
        echo "✅ Migration applied via Supabase CLI!"
        exit 0
    else
        echo ""
        echo "⚠️  Supabase CLI push failed"
    fi
fi

# Final fallback: Instructions
echo ""
echo "⚠️  Automatic migration failed"
echo ""
echo "📝 Please apply migration manually:"
echo ""
echo "   1. Go to: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"
echo "   2. Open: $MIGRATION_FILE"
echo "   3. Copy entire file contents"
echo "   4. Paste into SQL Editor"
echo "   5. Click Run"
echo ""
echo "   Migration file: $(pwd)/$MIGRATION_FILE"
echo ""
exit 1

