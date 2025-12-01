/**
 * Create Admin Role Record
 * 
 * Creates a user_roles record for an existing Supabase auth user
 * This is useful for creating admin accounts or fixing missing role records
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

// Admin user ID from the error message
const ADMIN_USER_ID = '219f2658-2fe0-46b3-aabc-413fd7e2120b'

async function createAdminRole() {
  console.log('🔐 Creating admin role record...\n')

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // First, check if user exists in auth.users
    console.log('1. Checking if user exists in auth.users...')
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(ADMIN_USER_ID)
    
    if (authError || !authUser.user) {
      console.error('❌ Error: User not found in auth.users')
      console.error('   Error:', authError?.message)
      process.exit(1)
    }

    console.log('   ✅ User found:', authUser.user.email)

    // Check if role record already exists
    console.log('\n2. Checking if user_roles record exists...')
    const { data: existingRole, error: checkError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', ADMIN_USER_ID)
      .single()

    if (existingRole && !checkError) {
      console.log('   ⚠️  User role record already exists:')
      console.log('   Role:', existingRole.role)
      console.log('   Approved:', existingRole.approved)
      console.log('   Clinic ID:', existingRole.clinicId || existingRole.clinic_id || 'Not set')
      console.log('\n   Updating to admin role...')
      
      // Update existing record to admin
      const { data: updated, error: updateError } = await supabase
        .from('user_roles')
        .update({
          role: 'admin',
          approved: true,
          clinicId: 'default-clinic', // Use camelCase since user changed the code
        })
        .eq('user_id', ADMIN_USER_ID)
        .select()
        .single()

      if (updateError) {
        console.error('❌ Error updating user role:', updateError.message)
        console.error('   Details:', updateError)
        process.exit(1)
      }

      console.log('   ✅ User role updated successfully!')
      console.log('   Role:', updated.role)
      console.log('   Approved:', updated.approved)
      console.log('   Clinic ID:', updated.clinicId || updated.clinic_id)
    } else {
      // Create new role record
      console.log('   Creating new admin role record...')
      
      const { data: newRole, error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: ADMIN_USER_ID,
          role: 'admin',
          approved: true,
          clinicId: 'default-clinic', // Try camelCase first
        })
        .select()
        .single()

      if (insertError) {
        // Try with snake_case if camelCase fails
        console.log('   ⚠️  camelCase failed, trying snake_case...')
        const { data: newRole2, error: insertError2 } = await supabase
          .from('user_roles')
          .insert({
            user_id: ADMIN_USER_ID,
            role: 'admin',
            approved: true,
            clinic_id: 'default-clinic', // Try snake_case
          })
          .select()
          .single()

        if (insertError2) {
          console.error('❌ Error creating user role:', insertError2.message)
          console.error('   Details:', insertError2)
          console.error('\n   Original error:', insertError.message)
          process.exit(1)
        }

        console.log('   ✅ User role created successfully with snake_case!')
        console.log('   Role:', newRole2.role)
        console.log('   Approved:', newRole2.approved)
        console.log('   Clinic ID:', newRole2.clinic_id || newRole2.clinicId)
      } else {
        console.log('   ✅ User role created successfully!')
        console.log('   Role:', newRole.role)
        console.log('   Approved:', newRole.approved)
        console.log('   Clinic ID:', newRole.clinicId || newRole.clinic_id)
      }
    }

    // Verify the record
    console.log('\n3. Verifying user role record...')
    const { data: verify, error: verifyError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', ADMIN_USER_ID)
      .single()

    if (verifyError || !verify) {
      console.error('❌ Error verifying user role:', verifyError?.message)
      process.exit(1)
    }

    console.log('   ✅ Verification successful!')
    console.log('   User ID:', verify.user_id)
    console.log('   Role:', verify.role)
    console.log('   Approved:', verify.approved)
    console.log('   Clinic ID:', verify.clinicId || verify.clinic_id || 'Not set')

    console.log('\n🎉 Admin role record created/updated successfully!')
    console.log('\n   You can now login with this admin account.')
  } catch (error: any) {
    console.error('\n❌ Unexpected error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run the script
createAdminRole()
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

