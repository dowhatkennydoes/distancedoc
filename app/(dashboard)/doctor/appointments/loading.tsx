/**
 * Loading Component for Appointments Page
 * 
 * Shows skeleton UI while page loads
 * Enables route-based code splitting
 */

import { DoctorAppointmentsSkeleton } from "@/components/ui/doctor-dashboard-skeletons"

export default function Loading() {
  return <DoctorAppointmentsSkeleton />
}

