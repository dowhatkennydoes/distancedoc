import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { getFirestore } from "@/lib/gcp/gcp-firestore"

export interface FeatureFlag {
  id: string
  key: string
  enabled: boolean
  description: string
  category: string
  defaultValue?: boolean
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
  updatedBy?: string
}

const DEFAULT_FEATURE_FLAGS = [
  {
    key: "ai_soap_generation",
    description: "AI SOAP note generation using Gemini",
    category: "AI Features",
    defaultValue: true,
  },
  {
    key: "audio_transcription",
    description: "Real-time audio transcription during consultations",
    category: "AI Features",
    defaultValue: true,
  },
  {
    key: "telehealth_video_quality_high",
    description: "High quality video (HD) for telehealth calls",
    category: "Telehealth",
    defaultValue: true,
  },
  {
    key: "telehealth_video_quality_medium",
    description: "Medium quality video (720p) for telehealth calls",
    category: "Telehealth",
    defaultValue: true,
  },
  {
    key: "telehealth_video_quality_low",
    description: "Low quality video (480p) for bandwidth-constrained connections",
    category: "Telehealth",
    defaultValue: true,
  },
  {
    key: "new_dashboard_ui",
    description: "New dashboard UI (A/B test variant)",
    category: "UI/UX",
    defaultValue: false,
  },
  {
    key: "new_patient_onboarding",
    description: "New patient onboarding prototype",
    category: "UI/UX",
    defaultValue: false,
  },
]

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const firestore = getFirestore()
    const flagsRef = firestore.collection("feature_flags")

    // Fetch all feature flags
    const snapshot = await flagsRef.get() as any

    let flags: FeatureFlag[] = []

    if (snapshot.empty) {
      // Initialize default flags if none exist
      const batch = firestore.batch()
      const now = new Date().toISOString()

      DEFAULT_FEATURE_FLAGS.forEach((defaultFlag) => {
        const docRef = flagsRef.doc(defaultFlag.key)
        batch.set(docRef, {
          key: defaultFlag.key,
          enabled: defaultFlag.defaultValue || false,
          description: defaultFlag.description,
          category: defaultFlag.category,
          defaultValue: defaultFlag.defaultValue || false,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        })
      })

      await batch.commit()

      // Fetch again after initialization
      const newSnapshot = await flagsRef.get() as any
      flags = newSnapshot.docs.map((doc: any) => {
        const data = doc.data()
        return {
          id: doc.id,
          key: data.key,
          enabled: data.enabled !== undefined ? data.enabled : data.defaultValue || false,
          description: data.description || "",
          category: data.category || "General",
          defaultValue: data.defaultValue !== undefined ? data.defaultValue : false,
          metadata: data.metadata || {},
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || undefined,
        }
      })
    } else {
      flags = snapshot.docs.map((doc: any) => {
        const data = doc.data()
        return {
          id: doc.id,
          key: data.key,
          enabled: data.enabled !== undefined ? data.enabled : data.defaultValue || false,
          description: data.description || "",
          category: data.category || "General",
          defaultValue: data.defaultValue !== undefined ? data.defaultValue : false,
          metadata: data.metadata || {},
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
          updatedBy: data.updatedBy || undefined,
        }
      })
    }

    // Group by category
    const flagsByCategory = flags.reduce((acc, flag) => {
      if (!acc[flag.category]) {
        acc[flag.category] = []
      }
      acc[flag.category].push(flag)
      return acc
    }, {} as Record<string, FeatureFlag[]>)

    return NextResponse.json({
      flags,
      flagsByCategory,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching feature flags:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch feature flags" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const body = await request.json()
    const { key, enabled, description, category, metadata } = body

    if (!key || typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "Missing required fields: key, enabled" },
        { status: 400 }
      )
    }

    const firestore = getFirestore()
    const flagRef = firestore.collection("feature_flags").doc(key)

    // Check if flag exists
    const doc = await flagRef.get() as any

    const updateData: any = {
      enabled,
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    }

    if (description !== undefined) {
      updateData.description = description
    }
    if (category !== undefined) {
      updateData.category = category
    }
    if (metadata !== undefined) {
      updateData.metadata = metadata
    }

    if (doc.exists) {
      // Update existing flag
      await flagRef.update(updateData)
    } else {
      // Create new flag
      await flagRef.set({
        key,
        enabled,
        description: description || "",
        category: category || "General",
        defaultValue: enabled,
        metadata: metadata || {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updatedBy: user.id,
      })
    }

    // Fetch updated flag
    const updatedDoc = await flagRef.get() as any
    const data = updatedDoc.data()

    return NextResponse.json({
      flag: {
        id: updatedDoc.id,
        key: data.key,
        enabled: data.enabled,
        description: data.description || "",
        category: data.category || "General",
        defaultValue: data.defaultValue !== undefined ? data.defaultValue : false,
        metadata: data.metadata || {},
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        updatedBy: data.updatedBy || undefined,
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error updating feature flag:", error)
    return NextResponse.json(
      { error: error.message || "Failed to update feature flag" },
      { status: 500 }
    )
  }
}

