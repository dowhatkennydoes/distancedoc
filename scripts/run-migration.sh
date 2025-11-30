#!/bin/bash

# Script to run Supabase migration for tenant isolation
# This applies the clinic_id migration to the database

set -e

echo "🚀 Running tenant isolation migration..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -d "supabase" ]; then
    echo "❌ supabase directory not found. Are you in the project root?"
    exit 1
fi

# Check if migration file exists
if [ ! -f "supabase/migrations/002_add_clinic_id.sql" ]; then
    echo "❌ Migration file not found: supabase/migrations/002_add_clinic_id.sql"
    exit 1
fi

echo "📋 Migration file found: 002_add_clinic_id.sql"
echo ""

# Check if Supabase is linked
if [ -z "$SUPABASE_PROJECT_REF" ] && [ ! -f "supabase/.temp/project-ref" ]; then
    echo "⚠️  Supabase project not linked. Attempting to link..."
    echo "   Please run: supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    read -p "Do you want to continue with local migration? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Run migration
echo "🔄 Applying migration..."
echo ""

if supabase db push 2>/dev/null; then
    echo "✅ Migration applied successfully!"
elif supabase migration up 2>/dev/null; then
    echo "✅ Migration applied successfully!"
else
    echo "⚠️  Could not auto-apply migration. Please run manually:"
    echo ""
    echo "   Option 1 (Supabase Dashboard):"
    echo "   1. Go to your Supabase project dashboard"
    echo "   2. Navigate to SQL Editor"
    echo "   3. Copy and paste the contents of supabase/migrations/002_add_clinic_id.sql"
    echo "   4. Run the SQL"
    echo ""
    echo "   Option 2 (Supabase CLI):"
    echo "   supabase db push"
    echo "   or"
    echo "   supabase migration up"
    echo ""
    exit 1
fi

echo ""
echo "✅ Next steps:"
echo "   1. Run: npx tsx scripts/assign-clinic-ids.ts [clinic-id]"
echo "   2. Update user_roles in Supabase:"
echo "      UPDATE user_roles SET clinic_id = 'your-clinic-id' WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';"
echo "   3. Test: npx tsx scripts/test-tenant-isolation.ts"
echo ""

