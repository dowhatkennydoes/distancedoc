/**
 * Update user_roles table with clinic IDs
 * This script updates the Supabase user_roles table directly
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function updateUserRolesClinic(clinicId: string = 'default-clinic') {
  console.log(`🔄 Updating user_roles with clinic ID: ${clinicId}\n`)

  try {
    // First, check if clinic_id column exists
    console.log('1. Checking user_roles table structure...')
    
    // Get all user_roles
    const { data: userRoles, error: fetchError } = await supabase
      .from('user_roles')
      .select('*')
      .limit(10)

    if (fetchError) {
      console.error('❌ Error fetching user_roles:', fetchError.message)
      throw fetchError
    }

    console.log(`   Found ${userRoles?.length || 0} user roles (showing first 10)`)
    console.log('')

    // Update all user_roles with clinic_id
    console.log('2. Updating user_roles with clinic IDs...')
    
    const { data: updated, error: updateError } = await supabase
      .from('user_roles')
      .update({ clinic_id: clinicId })
      .is('clinic_id', null)
      .select()

    if (updateError) {
      // Try alternative: update all records
      console.log('   ⚠️  Direct update failed, trying alternative method...')
      
      // Get all records and update individually
      const { data: allRoles, error: allError } = await supabase
        .from('user_roles')
        .select('id, clinic_id')

      if (allError) {
        console.error('❌ Error:', allError.message)
        throw allError
      }

      let updatedCount = 0
      for (const role of allRoles || []) {
        if (!role.clinic_id || role.clinic_id === 'default-clinic') {
          const { error: updateErr } = await supabase
            .from('user_roles')
            .update({ clinic_id: clinicId })
            .eq('id', role.id)

          if (!updateErr) {
            updatedCount++
          }
        }
      }

      console.log(`   ✅ Updated ${updatedCount} user roles`)
    } else {
      console.log(`   ✅ Updated ${updated?.length || 0} user roles`)
    }

    // Verify update
    console.log('\n3. Verifying update...')
    const { data: verify, error: verifyError } = await supabase
      .from('user_roles')
      .select('clinic_id')
      .limit(100)

    if (verifyError) {
      console.log('   ⚠️  Could not verify:', verifyError.message)
    } else {
      const withClinic = verify?.filter(r => r.clinic_id && r.clinic_id !== 'default-clinic').length || 0
      const total = verify?.length || 0
      console.log(`   📊 Sample: ${withClinic}/${total} have clinic IDs assigned`)
    }

    console.log('\n✅ User roles update complete!')
    console.log(`\n📝 Next: Run 'npm run assign:clinics' to update Prisma records`)

  } catch (error: any) {
    console.error('\n❌ Error updating user_roles:', error.message)
    console.log('\n💡 Alternative: Run this SQL in Supabase Dashboard:')
    console.log(`   UPDATE user_roles SET clinic_id = '${clinicId}' WHERE clinic_id IS NULL OR clinic_id = 'default-clinic';`)
    throw error
  }
}

// Get clinic ID from command line or use default
const clinicId = process.argv[2] || 'default-clinic'

updateUserRolesClinic(clinicId)
  .then(() => {
    console.log('\n✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error)
    process.exit(1)
  })

