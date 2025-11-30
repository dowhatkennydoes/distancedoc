#!/bin/bash

# Apply tenant isolation migration using Supabase CLI
# This script properly applies the migration to the linked Supabase project

set -e

echo "🚀 Applying Tenant Isolation Migration via Supabase CLI"
echo "========================================================"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Check if project is linked
if [ ! -f "supabase/.temp/project-ref" ]; then
    echo "📋 Linking to Supabase project..."
    echo "Project Ref: vhwvejtjrajjsluutrqv"
    echo ""
    
    # Try to link (may require interactive password)
    supabase link --project-ref vhwvejtjrajjsluutrqv || {
        echo ""
        echo "⚠️  Linking failed. Please link manually:"
        echo "   supabase link --project-ref vhwvejtjrajjsluutrqv"
        echo ""
        echo "Password: \$DistanceDoc2423"
        exit 1
    }
fi

echo "✅ Project linked"
echo ""

# Check migration file exists
if [ ! -f "supabase/migrations/002_add_clinic_id.sql" ]; then
    echo "❌ Migration file not found: supabase/migrations/002_add_clinic_id.sql"
    exit 1
fi

echo "📋 Migration file found"
echo ""

# Apply migration using db push
echo "🔄 Applying migration..."
echo ""

# Method 1: Try db push (applies all pending migrations)
if supabase db push --linked 2>&1 | tee /tmp/supabase-push.log; then
    echo ""
    echo "✅ Migration applied successfully!"
elif grep -q "already applied" /tmp/supabase-push.log 2>/dev/null; then
    echo ""
    echo "✅ Migration already applied"
elif supabase migration up --linked 2>&1; then
    echo ""
    echo "✅ Migration applied successfully!"
else
    echo ""
    echo "⚠️  Automatic migration failed. Trying direct SQL execution..."
    echo ""
    
    # Method 2: Execute SQL directly
    if command -v psql &> /dev/null; then
        echo "Using psql to apply migration..."
        PGPASSWORD='$DistanceDoc2423' psql \
            -h db.vhwvejtjrajjsluutrqv.supabase.co \
            -U postgres \
            -d postgres \
            -p 5432 \
            -f supabase/migrations/002_add_clinic_id.sql && {
            echo "✅ Migration applied via psql"
        } || {
            echo "❌ psql execution failed"
            echo ""
            echo "📝 Please apply migration manually:"
            echo "   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new"
            echo "   2. Open: supabase/migrations/002_add_clinic_id.sql"
            echo "   3. Copy and paste into SQL Editor"
            echo "   4. Click Run"
            exit 1
        }
    else
        echo "❌ Could not apply migration automatically"
        echo ""
        echo "📝 Please apply migration manually:"
        echo "   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new"
        echo "   2. Open: supabase/migrations/002_add_clinic_id.sql"
        echo "   3. Copy and paste into SQL Editor"
        echo "   4. Click Run"
        exit 1
    fi
fi

echo ""
echo "✅ Migration complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Run: npm run update:user-roles"
echo "   2. Run: npm run assign:clinics"
echo "   3. Run: npm run test:tenant"
echo ""

