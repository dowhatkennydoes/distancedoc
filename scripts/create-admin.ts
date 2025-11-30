#!/usr/bin/env tsx
/**
 * Script to create an admin user in Supabase
 * 
 * Usage:
 *   tsx scripts/create-admin.ts <email> <password>
 * 
 * Or run interactively:
 *   tsx scripts/create-admin.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as readline from 'readline'
import * as fs from 'fs'
import * as path from 'path'

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        process.env[key] = value
      }
    })
  }
}

loadEnvFile()

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   - NEXT_PUBLIC_SUPABASE_URL')
  console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  console.error('\nMake sure you have a .env.local file with these values.')
  process.exit(1)
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

async function createAdminUser(email: string, password: string) {
  console.log('\n🔐 Creating admin user...\n')

  try {
    // Create user in Supabase Auth
    console.log('1. Creating user in Supabase Auth...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    })

    if (authError) {
      if (authError.message.includes('already registered')) {
        console.log('⚠️  User already exists. Updating to admin role...')
        
        // Get existing user
        const { data: existingUsers, error: lookupError } = await supabase.auth.admin.listUsers()
        if (lookupError) {
          throw new Error(`Failed to lookup user: ${lookupError.message}`)
        }
        
        const existingUser = existingUsers.users.find(u => u.email === email)
        if (!existingUser) {
          throw new Error('User exists but could not be found')
        }

        // Update password if needed
        if (password) {
          await supabase.auth.admin.updateUserById(existingUser.id, {
            password,
          })
        }

        // Check if user_roles entry exists
        const { data: existingRole, error: roleCheckError } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', existingUser.id)
          .single()

        if (existingRole) {
          // Update existing role to admin
          const { error: updateError } = await supabase
            .from('user_roles')
            .update({
              role: 'admin',
              approved: true,
            })
            .eq('user_id', existingUser.id)

          if (updateError) {
            throw new Error(`Failed to update user role: ${updateError.message}`)
          }
          console.log('✅ Updated existing user to admin role')
        } else {
          // Create new role entry
          const { error: insertError } = await supabase
            .from('user_roles')
            .insert({
              user_id: existingUser.id,
              role: 'admin',
              approved: true,
            })

          if (insertError) {
            throw new Error(`Failed to create user role: ${insertError.message}`)
          }
          console.log('✅ Created admin role for existing user')
        }

        console.log('\n✅ Admin user ready!')
        console.log(`   Email: ${email}`)
        console.log(`   User ID: ${existingUser.id}`)
        return
      }
      throw authError
    }

    if (!authData.user) {
      throw new Error('Failed to create user: No user data returned')
    }

    console.log('✅ User created in Auth')

    // Create user role entry
    console.log('2. Creating admin role entry...')
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
        approved: true,
      })

    if (roleError) {
      // Rollback: delete auth user if role creation fails
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw new Error(`Failed to create user role: ${roleError.message}`)
    }

    console.log('✅ Admin role created')

    console.log('\n✅ Admin user created successfully!')
    console.log(`   Email: ${email}`)
    console.log(`   User ID: ${authData.user.id}`)
    console.log('\n📝 You can now log in at http://localhost:3000/login')
  } catch (error: any) {
    console.error('\n❌ Error creating admin user:')
    console.error(`   ${error.message}`)
    process.exit(1)
  }
}

async function main() {
  console.log('🔐 DistanceDoc Admin User Creator\n')

  let email: string
  let password: string

  // Check if email and password provided as arguments
  if (process.argv.length >= 4) {
    email = process.argv[2]
    password = process.argv[3]
  } else {
    // Interactive mode
    email = await prompt('Enter admin email: ')
    password = await prompt('Enter admin password (min 8 characters): ')
  }

  if (!email || !password) {
    console.error('❌ Email and password are required')
    process.exit(1)
  }

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters')
    process.exit(1)
  }

  await createAdminUser(email, password)
}

main()

