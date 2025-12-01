/**
 * Example: Applying AdminRoute to an Existing Admin Page
 * 
 * This shows how to update the actual admin dashboard page
 * to use AdminRoute for client-side protection.
 */

"use client"

import * as React from "react"
import { AdminRoute } from "@/components/auth/AdminRoute"
import { AdminLayout } from "@/components/admin/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// ... other imports

/**
 * BEFORE: Admin dashboard without AdminRoute
 * 
 * export default function AdminDashboardPage() {
 *   const { user } = useAuth()
 *   // No protection - relies only on middleware
 *   return (
 *     <AdminLayout>
 *       <div>Dashboard content</div>
 *     </AdminLayout>
 *   )
 * }
 */

/**
 * AFTER: Admin dashboard with AdminRoute
 * 
 * This wraps the entire page content with AdminRoute,
 * which will:
 * 1. Check if user is authenticated
 * 2. Check if user is admin
 * 3. Redirect if not allowed
 * 4. Show loader during auth check
 */
export default function AdminDashboardPageWithProtection() {
  return (
    <AdminRoute>
      <AdminLayout>
        {/* All existing dashboard content goes here */}
        <div className="p-6">
          <h1>Admin Dashboard</h1>
          <p>Protected with AdminRoute</p>
        </div>
      </AdminLayout>
    </AdminRoute>
  )
}

/**
 * Alternative: Wrapper Pattern
 * 
 * If you have many admin pages, create a wrapper:
 */
function AdminPageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AdminRoute>
      <AdminLayout>
        {children}
      </AdminLayout>
    </AdminRoute>
  )
}

/**
 * Then use it in all admin pages:
 */
export function AdminDoctorsPage() {
  return (
    <AdminPageWrapper>
      <div>Doctors management content</div>
    </AdminPageWrapper>
  )
}

export function AdminPatientsPage() {
  return (
    <AdminPageWrapper>
      <div>Patients management content</div>
    </AdminPageWrapper>
  )
}

