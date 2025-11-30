'use client'

// TODO: Individual visit summary page
// TODO: View full SOAP note
// TODO: Read-only display
// TODO: Download option

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
  procedures?: string[]
  followUpDate?: string
  signedAt?: string
}

export default function VisitSummaryPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [summary, setSummary] = useState<VisitSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch(`/api/visit-notes/patient`, {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch visit summary')
        }

        const summaries = await response.json()
        const found = summaries.find((s: VisitSummary) => s.id === params.id)
        
        if (!found) {
          router.push('/patient/summaries')
          return
        }

        setSummary(found)
      } catch (error) {
        console.error('Error fetching summary:', error)
        router.push('/patient/summaries')
      } finally {
        setLoadingSummary(false)
      }
    }

    if (user) {
      fetchSummary()
    }
  }, [user, params.id, router])

  if (loading || loadingSummary || !summary) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/patient/summaries"
          className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
        >
          ← Back to Summaries
        </Link>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Visit Summary</h1>
            <p className="text-gray-600">
              {new Date(summary.appointmentDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Print / Download
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
        {/* Doctor Info */}
        <div className="border-b border-gray-200 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Provider</h2>
          <p className="text-gray-700">{summary.doctor.name}</p>
          {summary.doctor.specialization && (
            <p className="text-sm text-gray-600">{summary.doctor.specialization}</p>
          )}
        </div>

        {/* Chief Complaint */}
        {summary.chiefComplaint && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Chief Complaint</h2>
            <p className="text-gray-700">{summary.chiefComplaint}</p>
          </div>
        )}

        {/* SOAP Note Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {summary.subjective && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Subjective (S)</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{summary.subjective}</p>
            </div>
          )}

          {summary.objective && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Objective (O)</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{summary.objective}</p>
            </div>
          )}

          {summary.assessment && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Assessment (A)</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{summary.assessment}</p>
            </div>
          )}

          {summary.plan && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Plan (P)</h2>
              <p className="text-gray-700 whitespace-pre-wrap">{summary.plan}</p>
            </div>
          )}
        </div>

        {/* Diagnosis Codes */}
        {summary.diagnosis && summary.diagnosis.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Diagnosis Codes</h2>
            <div className="flex flex-wrap gap-2">
              {summary.diagnosis.map((code, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-gray-100 text-gray-700 text-sm font-mono rounded"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Procedure Codes */}
        {summary.procedures && summary.procedures.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Procedure Codes</h2>
            <div className="flex flex-wrap gap-2">
              {summary.procedures.map((code, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-mono rounded"
                >
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Follow-up */}
        {summary.followUpDate && (
          <div className="border-t border-gray-200 pt-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Follow-up</h2>
            <p className="text-gray-700">
              {new Date(summary.followUpDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
        )}

        {/* Signature */}
        {summary.signedAt && (
          <div className="border-t border-gray-200 pt-4 text-sm text-gray-500">
            Signed: {new Date(summary.signedAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  )
}

