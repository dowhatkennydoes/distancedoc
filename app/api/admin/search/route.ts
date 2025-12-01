import { NextRequest, NextResponse } from "next/server"
import { requireSession } from "@/lib/auth/guards"
import { requireRole } from "@/lib/auth/guards"
import { prisma } from "@/db/prisma"
import { getFirestore } from "@/lib/gcp/gcp-firestore"

export async function GET(request: NextRequest) {
  try {
    const user = await requireSession(request)
    requireRole(user, "admin", {
      requestId: request.headers.get("x-request-id") || undefined,
    })

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q") || ""
    const limit = parseInt(searchParams.get("limit") || "10", 10)

    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        results: {
          doctors: [],
          patients: [],
          appointments: [],
          clinics: [],
          auditLogs: [],
          settings: [],
        },
        total: 0,
      })
    }

    const searchTerm = query.trim().toLowerCase()

    // Search doctors
    const doctors = await prisma.doctor.findMany({
      where: {
        OR: [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
          { specialty: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        specialty: true,
        clinicId: true,
      },
      take: limit,
    })

    // Search patients
    const patients = await prisma.patient.findMany({
      where: {
        OR: [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
          { phone: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        clinicId: true,
        dateOfBirth: true,
      },
      take: limit,
    })

    // Search appointments
    const appointments = await prisma.appointment.findMany({
      where: {
        OR: [
          { id: { contains: searchTerm, mode: "insensitive" } },
          {
            patient: {
              OR: [
                { firstName: { contains: searchTerm, mode: "insensitive" } },
                { lastName: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
          {
            doctor: {
              OR: [
                { firstName: { contains: searchTerm, mode: "insensitive" } },
                { lastName: { contains: searchTerm, mode: "insensitive" } },
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        patientId: true,
        doctorId: true,
        patient: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        doctor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        clinicId: true,
      },
      take: limit,
    })

    // Search clinics
    const clinics = await prisma.clinic.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
          { phone: { contains: searchTerm, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
      },
      take: limit,
    })

    // Search audit logs (Firestore)
    let auditLogs: any[] = []
    try {
      const firestore = getFirestore()
      const auditLogsRef = firestore.collection("audit_logs")
      const snapshot = await auditLogsRef
        .where("action", ">=", searchTerm)
        .where("action", "<=", searchTerm + "\uf8ff")
        .orderBy("timestamp", "desc")
        .limit(limit)
        .get() as any

      auditLogs = snapshot.docs.slice(0, limit).map((doc: any) => {
        const data = doc.data()
        return {
          id: doc.id,
          action: data.action,
          resourceType: data.resourceType,
          resourceId: data.resourceId,
          timestamp: data.timestamp?.toDate?.()?.toISOString() || data.timestamp,
          userId: data.userId,
          clinicId: data.clinicId,
        }
      })
    } catch (error) {
      // Firestore search failed, skip
      console.error("Failed to search audit logs:", error)
    }

    // Settings pages (static)
    const settingsPages = [
      { id: "dashboard", title: "Dashboard", href: "/admin", category: "Settings" },
      { id: "doctors", title: "Doctors", href: "/admin/doctors", category: "Settings" },
      { id: "patients", title: "Patients", href: "/admin/patients", category: "Settings" },
      { id: "appointments", title: "Appointments", href: "/admin/appointments", category: "Settings" },
      { id: "clinics", title: "Clinics", href: "/admin/clinics", category: "Settings" },
      { id: "billing", title: "Billing", href: "/admin/billing", category: "Settings" },
      { id: "audit", title: "Audit Logs", href: "/admin/audit", category: "Settings" },
      { id: "security", title: "Security", href: "/admin/security", category: "Settings" },
      { id: "flags", title: "Feature Flags", href: "/admin/flags", category: "Settings" },
    ].filter((page) => page.title.toLowerCase().includes(searchTerm) || page.href.toLowerCase().includes(searchTerm))

    // Format results
    const results = {
      doctors: doctors.map((d) => ({
        id: d.id,
        type: "doctor" as const,
        title: `${d.firstName} ${d.lastName}`,
        subtitle: d.specialty || d.email || "No specialty",
        href: `/admin/doctors/${d.id}`,
        metadata: {
          email: d.email,
          specialty: d.specialty,
          clinicId: d.clinicId,
        },
      })),
      patients: patients.map((p) => ({
        id: p.id,
        type: "patient" as const,
        title: `${p.firstName} ${p.lastName}`,
        subtitle: p.email || p.phone || "No contact info",
        href: `/admin/patients/${p.id}`,
        metadata: {
          email: p.email,
          phone: p.phone,
          clinicId: p.clinicId,
          dateOfBirth: p.dateOfBirth?.toISOString(),
        },
      })),
      appointments: appointments.map((a) => ({
        id: a.id,
        type: "appointment" as const,
        title: `Appointment: ${a.patient.firstName} ${a.patient.lastName} with ${a.doctor.firstName} ${a.doctor.lastName}`,
        subtitle: new Date(a.scheduledAt).toLocaleString(),
        href: `/admin/appointments?appointment=${a.id}`,
        metadata: {
          status: a.status,
          scheduledAt: a.scheduledAt.toISOString(),
          patientId: a.patientId,
          doctorId: a.doctorId,
          clinicId: a.clinicId,
        },
      })),
      clinics: clinics.map((c) => ({
        id: c.id,
        type: "clinic" as const,
        title: c.name || "Unnamed Clinic",
        subtitle: c.email || c.phone || c.address || "No contact info",
        href: `/admin/clinics/${c.id}`,
        metadata: {
          email: c.email,
          phone: c.phone,
          address: c.address,
        },
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        type: "audit_log" as const,
        title: log.action,
        subtitle: `${log.resourceType}: ${log.resourceId?.slice(0, 8)}...`,
        href: `/admin/audit?log=${log.id}`,
        metadata: {
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          timestamp: log.timestamp,
          userId: log.userId,
          clinicId: log.clinicId,
        },
      })),
      settings: settingsPages.map((page) => ({
        id: page.id,
        type: "settings" as const,
        title: page.title,
        subtitle: "Settings Page",
        href: page.href,
        metadata: {
          category: page.category,
        },
      })),
    }

    const total = Object.values(results).reduce((sum, arr) => sum + arr.length, 0)

    return NextResponse.json({
      results,
      total,
      query: searchTerm,
    })
  } catch (error: any) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      )
    }
    console.error("Error performing search:", error)
    return NextResponse.json(
      { error: error.message || "Failed to perform search" },
      { status: 500 }
    )
  }
}

