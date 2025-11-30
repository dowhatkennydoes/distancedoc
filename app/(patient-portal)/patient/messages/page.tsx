'use client'

// TODO: Messages page
// TODO: List message threads with doctors
// TODO: View and send messages
// TODO: Real-time updates

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Message {
  id: string
  content: string
  senderId: string
  senderRole: string
  createdAt: string
  read: boolean
}

interface MessageThread {
  id: string
  doctor: {
    name: string
    specialization?: string
  }
  lastMessage: Message
  unreadCount: number
}

export default function MessagesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [loadingThreads, setLoadingThreads] = useState(true)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        const response = await fetch('/api/messages/threads', {
          credentials: 'include',
        })

        if (!response.ok) {
          throw new Error('Failed to fetch message threads')
        }

        const data = await response.json()
        setThreads(data)
      } catch (error) {
        console.error('Error fetching threads:', error)
      } finally {
        setLoadingThreads(false)
      }
    }

    if (user) {
      fetchThreads()
      
      // Set up real-time updates via polling (can be upgraded to WebSocket/SSE)
      const interval = setInterval(fetchThreads, 30000) // Poll every 30 seconds
      
      return () => clearInterval(interval)
    }
  }, [user])

  if (loading || loadingThreads) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        <Link
          href="/patient/messages/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          New Message
        </Link>
      </div>

      {threads.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <span className="text-5xl block mb-4">💬</span>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No messages</h3>
          <p className="text-gray-600 mb-6">Start a conversation with your doctor.</p>
          <Link
            href="/patient/messages/new"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            New Message
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/patient/messages/${thread.id}`}
              className="block bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {thread.doctor.name}
                    </h3>
                    {thread.doctor.specialization && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        {thread.doctor.specialization}
                      </span>
                    )}
                    {thread.unreadCount > 0 && (
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-full">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-600 mb-1 line-clamp-2">{thread.lastMessage.content}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(thread.lastMessage.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-2xl ml-4">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

