#!/usr/bin/env tsx

/**
 * Quick Fix: Add clinic_id to user_roles table if missing
 * Then assign admin user to default clinic
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

async function quickFix() {
  try {
    console.log('🔧 Quick fix: Adding clinic_id column and updating admin...')

    // Check if clinic_id column exists by querying user_roles
    const { data: existingData, error: checkError } = await supabase
      .from('user_roles')
      .select('id, user_id, role')
      .limit(1)

    if (checkError) {
      console.error('❌ Error checking user_roles table:', checkError)
      process.exit(1)
    }

    console.log('✅ User_roles table exists, found records:', existingData?.length || 0)

    // Try to use raw SQL via rpc (if there's an rpc function) or manual process
    // First, let's check what columns exist
    const { data: adminUser, error: adminError } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', '219f2658-2fe0-46b3-aabc-413fd7e2120b')
      .single()

    if (adminError) {
      console.error('❌ Error finding admin user:', adminError)
      process.exit(1)
    }

    console.log('✅ Found admin user:', adminUser)

    // Check if clinic_id column exists by looking at the returned data
    if ('clinic_id' in adminUser) {
      console.log('✅ clinic_id column already exists!')
      
      if (adminUser.clinic_id) {
        console.log(`✅ Admin already assigned to clinic: ${adminUser.clinic_id}`)
        return
      }

      // Update the clinic_id
      const { data: updateData, error: updateError } = await supabase
        .from('user_roles')
        .update({ clinic_id: 'admin-clinic-default' })
        .eq('user_id', '219f2658-2fe0-46b3-aabc-413fd7e2120b')
        .select()

      if (updateError) {
        console.error('❌ Error updating admin clinic:', updateError)
        process.exit(1)
      }

      console.log('✅ Admin clinic updated:', updateData)
    } else {
      console.log('❌ clinic_id column does not exist in user_roles table')
      console.log('📝 Migration needs to be applied via SQL Editor:')
      console.log('   1. Go to: https://supabase.com/dashboard/project/vhwvejtjrajjsluutrqv/sql/new')
      console.log('   2. Run: ALTER TABLE user_roles ADD COLUMN clinic_id TEXT NOT NULL DEFAULT \'default-clinic\';')
      console.log('   3. Then re-run this script')
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error)
    process.exit(1)
  }
}

quickFix()