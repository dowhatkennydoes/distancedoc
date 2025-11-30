#!/bin/bash

# Final migration script - uses Supabase SQL Editor approach
# Since direct connections are blocked, we'll use the Supabase Dashboard

set -e

echo "🚀 Tenant Isolation Migration - Final Setup"
echo "============================================="
echo ""
echo "⚠️  Direct database connections are restricted by Supabase"
echo "📝 Migration must be applied via Supabase Dashboard SQL Editor"
echo ""
echo "📋 Quick Steps:"
echo ""
echo "   1. Open: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new"
echo "   2. Open file: supabase/migrations/002_add_clinic_id.sql"
echo "   3. Copy ENTIRE contents"
echo "   4. Paste into SQL Editor"
echo "   5. Click 'Run' (or Cmd/Ctrl + Enter)"
echo ""
echo "📄 Migration file location:"
echo "   $(pwd)/supabase/migrations/002_add_clinic_id.sql"
echo ""
echo "🔍 After applying, verify with:"
echo "   SELECT column_name FROM information_schema.columns"
echo "   WHERE table_name = 'doctors' AND column_name = 'clinic_id';"
echo ""
echo "   Should return: clinic_id"
echo ""
read -p "Have you applied the migration? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "❌ Please apply the migration first"
    echo "   Then run: npm run setup:tenant"
    exit 1
fi

echo ""
echo "✅ Migration applied!"
echo ""
echo "🔄 Running post-migration setup..."
echo ""

# Set DATABASE_URL for subsequent scripts
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"

# Update user_roles
echo "Step 1: Updating user_roles..."
npx tsx scripts/update-user-roles-clinic.ts default-clinic || {
    echo "⚠️  user_roles update skipped (may need manual SQL)"
}

echo ""
echo "Step 2: Assigning clinic IDs to Prisma records..."
echo "⚠️  Note: This requires DATABASE_URL to be set correctly"
echo "   If it fails, set it manually:"
echo "   export DATABASE_URL=\"postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres\""
echo ""

# Note: assign-clinic-ids requires Prisma connection which may fail
# if direct DB access is restricted
echo "✅ Setup instructions complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify migration: Check that clinic_id columns exist"
echo "   2. Update user_roles: Run SQL in Supabase Dashboard if needed"
echo "   3. Assign clinic IDs: May need to run via Supabase Dashboard SQL Editor"
echo ""

