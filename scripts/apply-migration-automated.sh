#!/bin/bash

# Automated migration script that opens the SQL in the browser
# and provides copy-paste instructions

set -e

echo "🚀 Tenant Isolation Migration - Automated Helper"
echo "================================================="
echo ""

PROJECT_REF="vhwvejtjrajjsluutrqv"
MIGRATION_FILE="supabase/migrations/002_add_clinic_id.sql"
SQL_EDITOR_URL="https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new"

echo "📋 Migration file: $MIGRATION_FILE"
echo "🔗 SQL Editor: $SQL_EDITOR_URL"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Display migration SQL
echo "📄 Migration SQL:"
echo "================="
echo ""
cat "$MIGRATION_FILE"
echo ""
echo "================="
echo ""

# Try to open browser (macOS)
if command -v open &> /dev/null; then
    echo "🌐 Opening Supabase SQL Editor in browser..."
    open "$SQL_EDITOR_URL" 2>/dev/null || true
    echo ""
fi

echo "📝 Instructions:"
echo "   1. SQL Editor should be open in your browser"
echo "   2. Copy the SQL above (entire file)"
echo "   3. Paste into the SQL Editor"
echo "   4. Click 'Run' button (or press Cmd/Ctrl + Enter)"
echo ""
echo "⏳ Waiting for you to apply the migration..."
echo ""
read -p "Have you applied the migration? (y/n) " -n 1 -r
echo ""

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

# Set DATABASE_URL
export DATABASE_URL="postgresql://postgres:\$DistanceDoc2423@db.vhwvejtjrajjsluutrqv.supabase.co:5432/postgres"

# Update user_roles via Supabase API
echo "Step 1: Updating user_roles..."
npx tsx scripts/update-user-roles-clinic.ts default-clinic || {
    echo "⚠️  user_roles update may need manual SQL"
    echo "   Run in SQL Editor:"
    echo "   UPDATE user_roles SET clinic_id = 'default-clinic' WHERE clinic_id IS NULL;"
}

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next: Run 'npm run assign:clinics' to assign clinic IDs to Prisma records"
echo "   (Note: This requires DATABASE_URL to be accessible)"
echo ""

