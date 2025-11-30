'use client'

// TODO: Individual message thread page
// TODO: View messages in thread
// TODO: Send new messages
// TODO: Real-time updates

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { getFirestoreClient } from '@/lib/firestore/client'
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'

interface Message {
  id: string
  content: string
  senderId: string
  senderRole: string
  createdAt: any
  read: boolean
}

export default function MessageThreadPage({ params }: { params: { id: string } }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== 'patient')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user) return

    const firestore = getFirestoreClient()
    const messagesRef = collection(firestore, 'messages')
    
    const messagesQuery = query(
      messagesRef,
      where('threadId', '==', params.id),
      orderBy('createdAt', 'asc'),
      limit(100)
    )

    const unsubscribe = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Message[]
        setMessages(newMessages)
        
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 100)
      },
      (error) => {
        console.error('Error listening to messages:', error)
      }
    )

    return () => unsubscribe()
  }, [user, params.id])

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return

    setSending(true)
    try {
      const firestore = getFirestoreClient()
      const messagesRef = collection(firestore, 'messages')

      await addDoc(messagesRef, {
        threadId: params.id,
        senderId: user.id,
        senderRole: user.role.toUpperCase(),
        content: newMessage,
        attachments: [],
        read: false,
        createdAt: serverTimestamp(),
      })

      setNewMessage('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (loading || !user) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)]">
      <div className="mb-4">
        <button
          onClick={() => router.back()}
          className="text-blue-600 hover:text-blue-800 mb-2"
        >
          ← Back to Messages
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.senderId === user.id ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.senderId === user.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              <p
                className={`text-xs mt-1 ${
                  message.senderId === user.id ? 'text-blue-100' : 'text-gray-500'
                }`}
              >
                {message.createdAt?.toDate
                  ? new Date(message.createdAt.toDate()).toLocaleTimeString()
                  : new Date().toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={sending}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !newMessage.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  )
}

