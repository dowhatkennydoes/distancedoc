// TODO: Firestore client-side SDK for real-time chat
// TODO: Initialize Firebase client SDK (not server SDK)
// TODO: Support real-time listeners for chat messages
// TODO: Handle offline persistence
// TODO: Support emulator for local development

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore'

let app: FirebaseApp | null = null
let firestore: Firestore | null = null

// TODO: Initialize Firebase client
export function getFirebaseClient(): { app: FirebaseApp; firestore: Firestore } {
  if (app && firestore) {
    return { app, firestore }
  }

  const firebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG
    ? JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG)
    : {
        projectId: 'distancedoc',
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      }
  
  // Ensure required fields are present
  if (!firebaseConfig.apiKey) {
    console.warn('Firebase API key not configured. Some features may not work.')
  }

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig)
  } else {
    app = getApps()[0]
  }

  firestore = getFirestore(app)

  // Connect to emulator in development
  if (process.env.NODE_ENV === 'development' && process.env.FIRESTORE_EMULATOR_HOST) {
    try {
      connectFirestoreEmulator(firestore, 'localhost', 8080)
    } catch (error) {
      // Emulator already connected
    }
  }

  return { app, firestore }
}

// TODO: Get Firestore instance
export function getFirestoreClient(): Firestore {
  return getFirebaseClient().firestore
}

