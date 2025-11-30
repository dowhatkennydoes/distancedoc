// TODO: Firestore client initialization and helper functions
// TODO: Initialize Firestore client with project configuration
// TODO: Support both production and emulator modes
// TODO: Implement collection helpers for chats and messages
// TODO: Add real-time listener utilities
// TODO: Implement batch operations
// TODO: Add query pagination helpers
// TODO: Support transactions
// TODO: Add data validation
// TODO: Implement offline persistence
// TODO: Add security rules validation

import { Firestore, CollectionReference, Query } from '@google-cloud/firestore'

// TODO: Initialize Firestore client
let firestore: Firestore | null = null

function getFirestoreClient(): Firestore {
  if (!firestore) {
    const projectId = process.env.GCP_PROJECT_ID || 'distancedoc'
    
    // TODO: Support Firestore emulator for local development
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      firestore = new Firestore({
        projectId,
        host: process.env.FIRESTORE_EMULATOR_HOST,
        ssl: false,
      })
    } else if (process.env.GCP_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(
        Buffer.from(process.env.GCP_SERVICE_ACCOUNT, 'base64').toString('utf-8')
      )
      firestore = new Firestore({
        projectId,
        credentials: serviceAccount,
      })
    } else {
      firestore = new Firestore({
        projectId,
      })
    }
  }
  
  return firestore
}

// TODO: Get Firestore instance
export function getFirestore(): Firestore {
  return getFirestoreClient()
}

// TODO: Collection references
export const collections = {
  chats: (): CollectionReference => getFirestore().collection('chats'),
  messages: (): CollectionReference => getFirestore().collection('messages'),
  notifications: (): CollectionReference => getFirestore().collection('notifications'),
  users: (): CollectionReference => getFirestore().collection('users'),
  appointments: (): CollectionReference => getFirestore().collection('appointments'),
}

// TODO: Helper function to create a document
export async function createDocument<T extends { [key: string]: any }>(
  collection: CollectionReference,
  data: T,
  documentId?: string
): Promise<string> {
  const docRef = documentId
    ? collection.doc(documentId)
    : collection.doc()
  
  await docRef.set({
    ...data,
    createdAt: Firestore.FieldValue.serverTimestamp(),
    updatedAt: Firestore.FieldValue.serverTimestamp(),
  })
  
  return docRef.id
}

// TODO: Helper function to update a document
export async function updateDocument<T extends { [key: string]: any }>(
  collection: CollectionReference,
  documentId: string,
  data: Partial<T>
): Promise<void> {
  await collection.doc(documentId).update({
    ...data,
    updatedAt: Firestore.FieldValue.serverTimestamp(),
  })
}

// TODO: Helper function to get a document
export async function getDocument<T>(
  collection: CollectionReference,
  documentId: string
): Promise<T | null> {
  const doc = await collection.doc(documentId).get()
  
  if (!doc.exists) {
    return null
  }
  
  return {
    id: doc.id,
    ...doc.data(),
  } as T
}

// TODO: Helper function to delete a document
export async function deleteDocument(
  collection: CollectionReference,
  documentId: string
): Promise<void> {
  await collection.doc(documentId).delete()
}

// TODO: Helper function to query documents
export async function queryDocuments<T>(
  query: Query
): Promise<T[]> {
  const snapshot = await query.get()
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
}

// TODO: Helper function for paginated queries
export async function queryDocumentsPaginated<T>(
  query: Query,
  limit: number = 20,
  startAfter?: any
): Promise<{ data: T[]; lastDoc: any }> {
  let paginatedQuery = query.limit(limit)
  
  if (startAfter) {
    paginatedQuery = paginatedQuery.startAfter(startAfter)
  }
  
  const snapshot = await paginatedQuery.get()
  const lastDoc = snapshot.docs[snapshot.docs.length - 1]
  
  const data = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as T[]
  
  return {
    data,
    lastDoc: lastDoc || null,
  }
}

// TODO: Helper function for batch operations
export async function batchWrite(operations: Array<{
  type: 'create' | 'update' | 'delete'
  collection: CollectionReference
  documentId?: string
  data?: any
}>): Promise<void> {
  const batch = getFirestore().batch()
  
  for (const op of operations) {
    const docRef = op.documentId
      ? op.collection.doc(op.documentId)
      : op.collection.doc()
    
    switch (op.type) {
      case 'create':
        batch.set(docRef, {
          ...op.data,
          createdAt: Firestore.FieldValue.serverTimestamp(),
          updatedAt: Firestore.FieldValue.serverTimestamp(),
        })
        break
      case 'update':
        batch.update(docRef, {
          ...op.data,
          updatedAt: Firestore.FieldValue.serverTimestamp(),
        })
        break
      case 'delete':
        batch.delete(docRef)
        break
    }
  }
  
  await batch.commit()
}

// TODO: Helper function for transactions
export async function runTransaction<T>(
  callback: (transaction: Firestore.Transaction) => Promise<T>
): Promise<T> {
  return getFirestore().runTransaction(callback)
}

// TODO: Note: Real-time listeners are only available in the client-side Firebase SDK
// This server-side Firestore client does not support onSnapshot
// For real-time updates, use the client-side Firebase SDK (firebase/firestore) in React components
// Example client-side usage:
// import { collection, query, onSnapshot } from 'firebase/firestore'
// const unsubscribe = onSnapshot(query(collection(db, 'messages')), (snapshot) => { ... })

export { getFirestoreClient }

