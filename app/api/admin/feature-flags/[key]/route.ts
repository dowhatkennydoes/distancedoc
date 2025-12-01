import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { getFirestore } from "@/lib/gcp/gcp-firestore"

export async function GET(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const key = params.key

    const firestore = getFirestore()
    const flagRef = firestore.collection("feature_flags").doc(key)
    const doc = await flagRef.get() as any

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Feature flag not found" },
        { status: 404 }
      )
    }

    const data = doc.data()
    return NextResponse.json({
      flag: {
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
      },
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching feature flag:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch feature flag" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const key = params.key
    const body = await request.json()
    const { enabled, description, category, metadata } = body

    const firestore = getFirestore()
    const flagRef = firestore.collection("feature_flags").doc(key)

    // Check if flag exists
    const doc = await flagRef.get() as any
    if (!doc.exists) {
      return NextResponse.json(
        { error: "Feature flag not found" },
        { status: 404 }
      )
    }

    const updateData: any = {
      updatedAt: new Date().toISOString(),
      updatedBy: user.id,
    }

    if (enabled !== undefined) {
      updateData.enabled = enabled
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

    await flagRef.update(updateData)

    // Fetch updated flag
    const updatedDoc = await flagRef.get() as any
    const updatedData = updatedDoc.data()

    return NextResponse.json({
      flag: {
        id: updatedDoc.id,
        key: updatedData.key,
        enabled: updatedData.enabled !== undefined ? updatedData.enabled : updatedData.defaultValue || false,
        description: updatedData.description || "",
        category: updatedData.category || "General",
        defaultValue: updatedData.defaultValue !== undefined ? updatedData.defaultValue : false,
        metadata: updatedData.metadata || {},
        createdAt: updatedData.createdAt || new Date().toISOString(),
        updatedAt: updatedData.updatedAt || new Date().toISOString(),
        updatedBy: updatedData.updatedBy || undefined,
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

