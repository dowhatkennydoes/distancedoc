#!/usr/bin/env tsx
/**
 * Verify Doctor Availability Blocks
 * 
 * Shows all availability blocks that were created
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vhwvejtjrajjsluutrqv.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZod3ZlanRqcmFqanNsdXV0cnF2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDQxNjc4OSwiZXhwIjoyMDc5OTkyNzg5fQ.I00zyFCmPimIWKjFJRZgcjJzeQaRbIjANBDY7024ToI'

async function verifyAvailabilityBlocks() {
  console.log('🔍 Verifying Doctor Availability Blocks\n')
  console.log('='.repeat(50))

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Get all availability blocks
    const { data: blocks, error } = await supabase
      .from('doctor_availability')
      .select('*')
      .order('doctorId')
      .order('dayOfWeek')

    if (error) {
      console.error('❌ Error:', error.message)
      process.exit(1)
    }

    if (!blocks || blocks.length === 0) {
      console.log('⚠️  No availability blocks found.')
      console.log('   Run the seed script to create them.\n')
      return
    }

    console.log(`✅ Found ${blocks.length} availability block(s):\n`)

    // Group by doctor
    const byDoctor = blocks.reduce((acc: any, block: any) => {
      if (!acc[block.doctorId]) {
        acc[block.doctorId] = []
      }
      acc[block.doctorId].push(block)
      return acc
    }, {})

    // Get doctor info
    for (const [doctorId, doctorBlocks] of Object.entries(byDoctor)) {
      // Try to get doctor info
      const { data: doctor } = await supabase
        .from('doctors')
        .select('id, specialization')
        .eq('id', doctorId)
        .single()

      const doctorName = doctor?.specialization || 'Unknown Doctor'
      const blocks = doctorBlocks as any[]

      console.log(`👨‍⚕️  Doctor: ${doctorName} (ID: ${doctorId.substring(0, 8)}...)`)
      console.log(`   Clinic: ${blocks[0].clinicId}`)
      console.log(`   Availability:`)
      
      blocks.forEach((block) => {
        console.log(`     - ${block.dayOfWeek}: ${block.startTime}–${block.endTime}`)
      })
      
      console.log('')
    }

    console.log('='.repeat(50))
    console.log('✅ Verification complete!')
    
  } catch (error: any) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

verifyAvailabilityBlocks()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

