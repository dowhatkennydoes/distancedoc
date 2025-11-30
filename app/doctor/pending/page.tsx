'use client'

// TODO: Doctor approval pending page
// TODO: Show pending approval message
// TODO: Display doctor information
// TODO: Add contact support link

import { useAuth } from '@/contexts/AuthContext'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DoctorPendingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      if (user.role !== 'doctor') {
        router.push('/dashboard')
      } else if (user.metadata?.approved) {
        router.push('/dashboard/doctor')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow text-center">
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Account Pending Approval</h1>
          <p className="text-gray-600">
            Your doctor account is pending admin approval. You will receive an email
            notification once your account has been approved.
          </p>
          <div className="mt-6">
            <p className="text-sm text-gray-500">
              If you have questions, please contact support.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 text-blue-600 hover:underline"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

