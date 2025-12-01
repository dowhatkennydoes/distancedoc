#!/usr/bin/env tsx

/**
 * Test Authentication Flow
 */

async function testAuth() {
  try {
    console.log('🔍 Testing authentication flow...')

    // Test auth/me endpoint
    const meResponse = await fetch('http://localhost:3001/api/auth/me')
    const meData = await meResponse.json()
    console.log('✅ Auth/me response:', meData)

    // Test login with admin credentials
    const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'admin@distancedoc.com',
        password: '$DistanceDoc2423', // From user's message
      }),
    })

    const loginData = await loginResponse.json()
    console.log('✅ Login response status:', loginResponse.status)
    console.log('✅ Login response:', loginData)

    if (loginResponse.status === 200) {
      console.log('🎉 Authentication is working!')
    } else {
      console.log('❌ Login failed')
    }

  } catch (error) {
    console.error('❌ Test error:', error)
  }
}

testAuth()