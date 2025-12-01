#!/usr/bin/env tsx

/**
 * Fix Admin Clinic Assignment
 * 
 * Assigns the admin user to a default clinic so they can authenticate properly
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

async function fixAdminClinic() {
  try {
    console.log('🔧 Fixing admin clinic assignment...')

    // Update admin user clinic assignment
    const { data, error } = await supabase
      .from('user_roles')
      .update({ 
        clinic_id: 'admin-clinic-default'
      })
      .eq('user_id', '219f2658-2fe0-46b3-aabc-413fd7e2120b')
      .select()

    if (error) {
      console.error('❌ Error updating admin clinic:', error)
      process.exit(1)
    }

    console.log('✅ Admin clinic updated:', data)
    console.log('✅ Admin user now assigned to clinic: admin-clinic-default')

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
    console.log('🎉 Admin clinic assignment fixed!')

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

fixAdminClinic()