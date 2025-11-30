'use client'

// TODO: Patient portal dashboard
// TODO: Overview of upcoming visits, pending forms, unread messages
// TODO: Quick actions

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PatientDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [stats, setStats] = useState({
    upcomingVisits: 0,
    pendingForms: 0,
    unreadMessages: 0,
  })

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch appointments
        const appointmentsRes = await fetch('/api/appointments/patient?upcoming=true', {
          credentials: 'include',
        })
        const appointments = appointmentsRes.ok ? await appointmentsRes.json() : []

        // Fetch forms
        const patientRes = await fetch('/api/patient/profile', { credentials: 'include' })
        if (patientRes.ok) {
          const patient = await patientRes.json()
          const formsRes = await fetch(`/api/forms?patientId=${patient.id}`, {
            credentials: 'include',
          })
          const forms = formsRes.ok ? await formsRes.json() : []
          const pendingForms = forms.filter((f: any) => f.status === 'DRAFT')
          
          // Fetch messages
          const messagesRes = await fetch('/api/messages/threads', {
            credentials: 'include',
          })
          const threads = messagesRes.ok ? await messagesRes.json() : []
          const unreadMessages = threads.reduce((sum: number, t: any) => sum + (t.unreadCount || 0), 0)

          setStats({
            upcomingVisits: appointments.length,
            pendingForms: pendingForms.length,
            unreadMessages,
          })
        }
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }

    if (user) {
      fetchStats()
    }
  }, [user])

  if (loading || !user) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Welcome back, {user.email}</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link
          href="/patient/visits"
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming Visits</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.upcomingVisits}</p>
            </div>
            <span className="text-3xl">📅</span>
          </div>
        </Link>

        <Link
          href="/patient/forms"
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Forms</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingForms}</p>
            </div>
            <span className="text-3xl">📋</span>
          </div>
        </Link>

        <Link
          href="/patient/messages"
          className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Unread Messages</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.unreadMessages}</p>
            </div>
            <span className="text-3xl">💬</span>
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/patient/visits"
            className="text-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl block mb-2">📅</span>
            <span className="text-sm font-medium">Schedule Visit</span>
          </Link>
          <Link
            href="/patient/forms"
            className="text-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl block mb-2">📋</span>
            <span className="text-sm font-medium">Complete Forms</span>
          </Link>
          <Link
            href="/patient/messages"
            className="text-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl block mb-2">💬</span>
            <span className="text-sm font-medium">Send Message</span>
          </Link>
          <Link
            href="/patient/files"
            className="text-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl block mb-2">📁</span>
            <span className="text-sm font-medium">Upload File</span>
          </Link>
        </div>
      </div>
    </div>
  )
}

