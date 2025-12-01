import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get("limit") || "5", 10)

    // Query audit logs for recent logins
    // Note: This assumes you have an audit log table or can query Supabase auth logs
    // For now, we'll return mock data with a TODO to integrate with actual audit logs

    // TODO: Integrate with actual audit logging system
    // This is a placeholder - replace with real audit log queries
    const supabase = await createClient()

    // Query recent auth events from Supabase (if available)
    // For now, return mock data structure
    const mockLogins = [
      {
        id: "1",
        user: "doctor1@example.com",
        role: "Doctor",
        ip: "192.168.1.1",
        location: "New York, US",
        timestamp: new Date(Date.now() - 1000 * 60 * 15),
        status: "success",
      },
      {
        id: "2",
        user: "patient1@demo.com",
        role: "Patient",
        ip: "192.168.1.2",
        location: "Los Angeles, US",
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        status: "success",
      },
      {
        id: "3",
        user: "doctor2@example.com",
        role: "Doctor",
        ip: "192.168.1.3",
        location: "Chicago, US",
        timestamp: new Date(Date.now() - 1000 * 60 * 45),
        status: "success",
      },
      {
        id: "4",
        user: "admin@example.com",
        role: "Admin",
        ip: "192.168.1.4",
        location: "San Francisco, US",
        timestamp: new Date(Date.now() - 1000 * 60 * 60),
        status: "success",
      },
      {
        id: "5",
        user: "patient2@demo.com",
        role: "Patient",
        ip: "192.168.1.5",
        location: "Miami, US",
        timestamp: new Date(Date.now() - 1000 * 60 * 90),
        status: "failed",
      },
    ].slice(0, limit)

    return NextResponse.json(mockLogins)
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error fetching recent logins:", error)
    return NextResponse.json(
      { error: "Failed to fetch recent logins" },
      { status: 500 }
    )
  }
}

