/**
 * Verify Admin Role Record
 * 
 * Checks if the admin user has a role record in user_roles table
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

// Admin user ID from the error message
const ADMIN_USER_ID = '219f2658-2fe0-46b3-aabc-413fd7e2120b'

async function verifyAdminRole() {
  console.log('🔍 Verifying admin role record...\n')

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Get role record
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', ADMIN_USER_ID)
      .single()

    if (error) {
      console.error('❌ Error fetching role record:', error.message)
      console.error('   Details:', error)
      process.exit(1)
    }

    if (!data) {
      console.error('❌ No role record found for admin user')
      process.exit(1)
    }

    console.log('✅ Admin role record found:')
    console.log('   User ID:', data.user_id)
    console.log('   Role:', data.role)
    console.log('   Approved:', data.approved)
    console.log('   Clinic ID (snake_case):', (data as any).clinic_id || 'Not set')
    console.log('   Clinic ID (camelCase):', (data as any).clinicId || 'Not set')
    console.log('\n📋 Full record:')
    console.log(JSON.stringify(data, null, 2))
    
    console.log('\n✅ Verification complete!')
  } catch (error: any) {
    console.error('\n❌ Unexpected error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run the script
verifyAdminRole()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

