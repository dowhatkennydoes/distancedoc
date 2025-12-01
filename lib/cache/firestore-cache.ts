/**
 * Firestore Cache for Chat Messages
 * 
 * Uses Firestore's built-in caching for real-time chat data
 * Leverages Firestore's offline persistence and cache management
 */

import { getFirestore } from '@/lib/gcp/gcp-firestore'
import { DocumentSnapshot, QuerySnapshot } from '@google-cloud/firestore'

export interface FirestoreCacheOptions {
  ttl?: number // Time to live in seconds (for metadata, not chat messages)
  enableOfflinePersistence?: boolean
}

/**
 * Cache chat message in Firestore with metadata
 * Chat messages are naturally cached by Firestore's offline persistence
 */
export async function firestoreCacheSet(
  collection: string,
  docId: string,
  data: any,
  options?: FirestoreCacheOptions
): Promise<void> {
  const firestore = getFirestore()
  const docRef = firestore.collection(collection).doc(docId)
  
  const cacheData = {
    ...data,
    cachedAt: new Date().toISOString(),
    ...(options?.ttl && { expiresAt: new Date(Date.now() + options.ttl * 1000).toISOString() }),
  }
  
  await docRef.set(cacheData, { merge: true })
}

/**
 * Get cached chat message from Firestore
 * Returns null if not found or expired
 */
export async function firestoreCacheGet<T = any>(
  collection: string,
  docId: string
): Promise<T | null> {
  const firestore = getFirestore()
  const docRef = firestore.collection(collection).doc(docId)
  const doc = await docRef.get()
  
  if (!doc.exists) {
    return null
  }
  
  const data = doc.data() as any
  
  // Check expiration
  if (data.expiresAt) {
    const expiresAt = new Date(data.expiresAt)
    if (expiresAt < new Date()) {
      // Expired, delete and return null
      await docRef.delete()
      return null
    }
  }
  
  // Remove cache metadata
  const { cachedAt, expiresAt, ...originalData } = data
  return originalData as T
}

/**
 * Invalidate cached chat message
 */
export async function firestoreCacheInvalidate(
  collection: string,
  docId: string
): Promise<void> {
  const firestore = getFirestore()
  const docRef = firestore.collection(collection).doc(docId)
  await docRef.delete()
}

/**
 * Invalidate all cached items in a collection matching a pattern
 */
export async function firestoreCacheInvalidatePattern(
  collection: string,
  pattern: (doc: DocumentSnapshot) => boolean
): Promise<number> {
  const firestore = getFirestore()
  const snapshot = await firestore.collection(collection).get()
  
  let deletedCount = 0
  const batch = firestore.batch()
  
  snapshot.docs.forEach((doc) => {
    if (pattern(doc)) {
      batch.delete(doc.ref)
      deletedCount++
    }
  })
  
  if (deletedCount > 0) {
    await batch.commit()
  }
  
  return deletedCount
}

/**
 * Clear all expired cache entries in a collection
 */
export async function firestoreCacheClearExpired(collection: string): Promise<number> {
  const firestore = getFirestore()
  const now = new Date()
  const snapshot = await firestore
    .collection(collection)
    .where('expiresAt', '<', now.toISOString())
    .get()
  
  let deletedCount = 0
  const batch = firestore.batch()
  
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref)
    deletedCount++
  })
  
  if (deletedCount > 0) {
    await batch.commit()
  }
  
  return deletedCount
}

