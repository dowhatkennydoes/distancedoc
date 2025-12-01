/**
 * Loading Component for Dashboard Page
 * 
 * Shows skeleton UI while page loads
 * Enables route-based code splitting
 */

import { DoctorDashboardSkeleton } from "@/components/ui/doctor-dashboard-skeletons"

export default function Loading() {
  return <DoctorDashboardSkeleton />
}

