#!/usr/bin/env tsx

/**
 * Fix Admin Clinic Assignment - Use correct column name
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function fixAdminClinicId() {
  try {
    console.log('🔧 Fixing admin clinic assignment using correct column name...')

    // Check current admin user state
    const { data: currentAdmin, error: checkError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', '219f2658-2fe0-46b3-aabc-413fd7e2120b')
      .single()

    if (checkError) {
      console.error('❌ Error finding admin user:', checkError)
      process.exit(1)
    }

    console.log('✅ Current admin user data:', currentAdmin)

    // The table uses camelCase 'clinicId' not snake_case 'clinic_id'
    if (currentAdmin.clinicId && currentAdmin.clinicId !== 'default-clinic') {
      console.log(`✅ Admin already has clinic assigned: ${currentAdmin.clinicId}`)
      return
    }

    // Update using the correct column name (clinicId)
    const { data: updateData, error: updateError } = await supabase
      .from('user_roles')
      .update({ clinicId: 'admin-clinic-default' })
      .eq('user_id', '219f2658-2fe0-46b3-aabc-413fd7e2120b')
      .select()

    if (updateError) {
      console.error('❌ Error updating admin clinic:', updateError)
      process.exit(1)
    }

    console.log('✅ Admin clinic updated successfully:', updateData)

    // Verify the update
    const { data: verifyData, error: verifyError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', '219f2658-2fe0-46b3-aabc-413fd7e2120b')
      .single()

    if (verifyError) {
      console.error('❌ Error verifying update:', verifyError)
      process.exit(1)
    }

    console.log('✅ Verification successful:', verifyData)
    console.log('🎉 Admin clinic assignment fixed! Auth should work now.')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

fixAdminClinicId()