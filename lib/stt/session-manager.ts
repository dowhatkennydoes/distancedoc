// TODO: Stateless session management for STT streaming
// TODO: Track active streams using Firestore (stateless)
// TODO: Handle stream lifecycle
// TODO: Support multiple concurrent sessions
// TODO: Cleanup expired sessions

import { getFirestoreClient } from '@/lib/firestore/client'
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'

export interface StreamSession {
  sessionId: string
  consultationId: string
  userId: string
  createdAt: any
  lastActivity: any
  isActive: boolean
}

const SESSION_TTL = 30 * 60 * 1000 // 30 minutes

// TODO: Create or update stream session
export async function createStreamSession(
  sessionId: string,
  consultationId: string,
  userId: string
): Promise<void> {
  const firestore = getFirestoreClient()
  const sessionRef = doc(firestore, 'stt_sessions', sessionId)

  await setDoc(
    sessionRef,
    {
      sessionId,
      consultationId,
      userId,
      createdAt: serverTimestamp(),
      lastActivity: serverTimestamp(),
      isActive: true,
    },
    { merge: true }
  )
}

// TODO: Get stream session
export async function getStreamSession(
  sessionId: string
): Promise<StreamSession | null> {
  const firestore = getFirestoreClient()
  const sessionRef = doc(firestore, 'stt_sessions', sessionId)
  const sessionDoc = await getDoc(sessionRef)

  if (!sessionDoc.exists()) {
    return null
  }

  return sessionDoc.data() as StreamSession
}

// TODO: Update session activity
export async function updateSessionActivity(sessionId: string): Promise<void> {
  const firestore = getFirestoreClient()
  const sessionRef = doc(firestore, 'stt_sessions', sessionId)

  await setDoc(
    sessionRef,
    {
      lastActivity: serverTimestamp(),
    },
    { merge: true }
  )
}

// TODO: End stream session
export async function endStreamSession(sessionId: string): Promise<void> {
  const firestore = getFirestoreClient()
  const sessionRef = doc(firestore, 'stt_sessions', sessionId)

  await setDoc(
    sessionRef,
    {
      isActive: false,
      endedAt: serverTimestamp(),
    },
    { merge: true }
  )

  // Optionally delete after a delay (cleanup job)
  // For now, just mark as inactive
}

// TODO: Cleanup expired sessions (run as scheduled job)
export async function cleanupExpiredSessions(): Promise<void> {
  // This would be called by a Cloud Function or scheduled job
  // Query for sessions older than TTL and delete them
  // Implementation depends on your cleanup strategy
}

