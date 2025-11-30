// TODO: Speech-to-Text streaming utilities
// TODO: Manage streaming sessions statelessly
// TODO: Handle transcript storage in Firestore
// TODO: Support incremental transcript updates
// TODO: Handle session cleanup

import { getFirestoreClient } from '@/lib/firestore/client'
import { doc, updateDoc, arrayUnion, serverTimestamp, getDoc } from 'firebase/firestore'

export interface TranscriptEntry {
  text: string
  isFinal: boolean
  timestamp: any
  sessionId: string
}

// TODO: Append transcript to Firestore consultation
export async function appendTranscript(
  consultationId: string,
  transcript: string,
  isFinal: boolean,
  sessionId: string
): Promise<void> {
  const firestore = getFirestoreClient()
  const consultationRef = doc(firestore, 'consultations', consultationId)

  if (isFinal) {
    // Append final transcript
    await updateDoc(consultationRef, {
      transcription: arrayUnion({
        text: transcript,
        isFinal: true,
        timestamp: serverTimestamp(),
        sessionId,
      }),
      transcriptionUpdatedAt: serverTimestamp(),
    })
  } else {
    // Update partial transcript (replace last partial if exists)
    const consultationDoc = await getDoc(consultationRef)
    
    if (!consultationDoc.exists()) {
      throw new Error('Consultation not found')
    }

    const currentData = consultationDoc.data()
    const currentTranscription = (currentData?.transcription || []) as TranscriptEntry[]

    // Remove last partial transcript from this session if it exists
    const filteredTranscription = currentTranscription.filter(
      (t) => !(t.isFinal === false && t.sessionId === sessionId)
    )

    // Add new partial transcript
    filteredTranscription.push({
      text: transcript,
      isFinal: false,
      timestamp: serverTimestamp(),
      sessionId,
    })

    await updateDoc(consultationRef, {
      transcription: filteredTranscription,
      transcriptionUpdatedAt: serverTimestamp(),
    })
  }
}

// TODO: Get full transcription for a consultation
export async function getTranscription(
  consultationId: string
): Promise<TranscriptEntry[]> {
  const firestore = getFirestoreClient()
  const consultationRef = doc(firestore, 'consultations', consultationId)
  const consultationDoc = await getDoc(consultationRef)

  if (!consultationDoc.exists()) {
    throw new Error('Consultation not found')
  }

  const data = consultationDoc.data()
  return (data?.transcription || []) as TranscriptEntry[]
}

// TODO: Get formatted full text from transcription
export function formatTranscription(transcription: TranscriptEntry[]): string {
  return transcription
    .filter((t) => t.isFinal)
    .map((t) => t.text)
    .join(' ')
}

