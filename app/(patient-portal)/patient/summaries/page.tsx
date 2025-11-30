'use client'

// TODO: Visit summaries page
// TODO: List read-only SOAP notes
// TODO: View detailed visit summaries
// TODO: Download summaries

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface VisitSummary {
  id: string
  appointmentId: string
  appointmentDate: string
  doctor: {
    name: string
    specialization?: string
  }
  subjective?: string
  objective?: string
  assessment?: string
  plan?: string
  chiefComplaint?: string
  diagnosis?: string[]
}

export default function VisitSummariesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<VisitSummary[]>([])
  const [loadingSummaries, setLoadingSummaries] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchSummaries = async () => {
      try {
        const response = await fetch('/api/visit-notes/patient', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch visit summaries')
        }

        const data = await response.json()
        setSummaries(data)
      } catch (error) {
        console.error('Error fetching summaries:', error)
      } finally {
        setLoadingSummaries(false)
      }
    }

    if (user) {
      fetchSummaries()
    }
  }, [user])

  if (loading || loadingSummaries) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Visit Summaries</h1>

      {summaries.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">📄</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No visit summaries</h3>
          <p className="text-gray-600">Your visit summaries will appear here after consultations.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {summaries.map((summary) => (
            <div
              key={summary.id}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {summary.doctor.name}
                    </h3>
                    {summary.doctor.specialization && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        {summary.doctor.specialization}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {new Date(summary.appointmentDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <Link
                  href={`/patient/summaries/${summary.id}`}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  View Full Summary
                </Link>
              </div>

              {summary.chiefComplaint && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Chief Complaint</h4>
                  <p className="text-gray-600">{summary.chiefComplaint}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.subjective && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Subjective</h4>
                    <p className="text-sm text-gray-600 line-clamp-3">{summary.subjective}</p>
                  </div>
                )}
                {summary.objective && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Objective</h4>
                    <p className="text-sm text-gray-600 line-clamp-3">{summary.objective}</p>
                  </div>
                )}
                {summary.assessment && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Assessment</h4>
                    <p className="text-sm text-gray-600 line-clamp-3">{summary.assessment}</p>
                  </div>
                )}
                {summary.plan && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-1">Plan</h4>
                    <p className="text-sm text-gray-600 line-clamp-3">{summary.plan}</p>
                  </div>
                )}
              </div>

              {summary.diagnosis && summary.diagnosis.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Diagnosis Codes</h4>
                  <div className="flex flex-wrap gap-2">
                    {summary.diagnosis.map((code, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-mono rounded"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

