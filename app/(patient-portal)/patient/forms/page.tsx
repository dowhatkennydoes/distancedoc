'use client'

// TODO: Intake forms page
// TODO: List pending and completed forms
// TODO: Link to form completion

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Form {
  id: string
  title: string
  type: string
  status: string
  dueDate?: string
  submittedAt?: string
}

export default function IntakeFormsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [forms, setForms] = useState<Form[]>([])
  const [loadingForms, setLoadingForms] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchForms = async () => {
      try {
        // Get patient record first to get patientId
        const patientResponse = await fetch('/api/patient/profile', {
          credentials: 'include',
        })
        
        if (!patientResponse.ok) {
          throw new Error('Failed to fetch patient profile')
        }

        const patient = await patientResponse.json()
        
        // Fetch forms for this patient
        const response = await fetch(`/api/forms?patientId=${patient.id}`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch forms')
        }

        const data = await response.json()
        // Transform to match expected format
        const formatted = data.map((form: any) => ({
          id: form.id,
          title: (form.formData as any)?.title || 'Intake Form',
          type: form.type,
          status: form.status,
          dueDate: form.dueDate,
          submittedAt: form.submittedAt,
        }))
        setForms(formatted)
      } catch (error) {
        console.error('Error fetching forms:', error)
      } finally {
        setLoadingForms(false)
      }
    }

    if (user) {
      fetchForms()
    }
  }, [user])

  if (loading || loadingForms) {
    return <div className="text-center py-12">Loading...</div>
  }

  const pendingForms = forms.filter((f) => f.status === 'DRAFT')
  const completedForms = forms.filter((f) => f.status === 'SUBMITTED')

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Intake Forms</h1>

      {/* Pending Forms */}
      {pendingForms.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Pending Forms</h2>
          <div className="space-y-4">
            {pendingForms.map((form) => (
              <div
                key={form.id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{form.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">Type: {form.type.replace('_', ' ')}</p>
                    {form.dueDate && (
                      <p className="text-sm text-orange-600">
                        Due: {new Date(form.dueDate).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/patient/forms/${form.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Complete Form
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Forms */}
      {completedForms.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Completed Forms</h2>
          <div className="space-y-4">
            {completedForms.map((form) => (
              <div
                key={form.id}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{form.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">Type: {form.type.replace('_', ' ')}</p>
                    {form.submittedAt && (
                      <p className="text-sm text-gray-500">
                        Submitted: {new Date(form.submittedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-sm font-medium rounded">
                    Completed
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {forms.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">📋</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No forms available</h3>
          <p className="text-gray-600">Your doctor will assign intake forms when needed.</p>
        </div>
      )}
    </div>
  )
}

