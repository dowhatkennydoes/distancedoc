/**
 * AdminRoute Component - Usage Examples
 * 
 * This file demonstrates various ways to use the AdminRoute component
 * for protecting admin routes in Next.js client components.
 */

"use client"

import { AdminRoute } from "./AdminRoute"
import { AdminLayout } from "@/components/admin/layout"

// ============================================================================
// Example 1: Simple Admin Page Protection
// ============================================================================

/**
 * Basic usage - wraps entire page content
 * Automatically redirects if not authenticated or not admin
 */
export function Example1_SimpleAdminPage() {
  return (
    <AdminRoute>
      <div className="container mx-auto p-6">
        <h1>Admin Dashboard</h1>
        <p>This page is only accessible to admins</p>
      </div>
    </AdminRoute>
  )
}

// ============================================================================
// Example 2: Admin Page with Layout
// ============================================================================

/**
 * Admin page with AdminLayout wrapper
 * AdminRoute ensures only admins can access, AdminLayout provides UI structure
 */
export function Example2_AdminPageWithLayout() {
  return (
    <AdminRoute>
      <AdminLayout>
        <div className="p-6">
          <h1>Admin Settings</h1>
          <p>Manage system settings</p>
        </div>
      </AdminLayout>
    </AdminRoute>
  )
}

// ============================================================================
// Example 3: Custom Redirect Destination
// ============================================================================

/**
 * Admin page with custom redirect destination
 * Useful when you want to redirect to a specific page instead of default
 */
export function Example3_CustomRedirect() {
  return (
    <AdminRoute redirectTo="/login?admin=true">
      <div className="container mx-auto p-6">
        <h1>Admin Reports</h1>
        <p>Generate admin reports</p>
      </div>
    </AdminRoute>
  )
}

// ============================================================================
// Example 4: Nested Admin Routes
// ============================================================================

/**
 * Nested admin content within other components
 * AdminRoute can be used at any level in the component tree
 */
export function Example4_NestedAdminContent() {
  return (
    <div className="min-h-screen">
      <header className="border-b">
        <h1>App Header</h1>
      </header>
      
      <main>
        <AdminRoute>
          <section className="p-6">
            <h2>Admin Section</h2>
            <p>This section is only visible to admins</p>
          </section>
        </AdminRoute>
      </main>
    </div>
  )
}

// ============================================================================
// Example 5: Conditional Admin Content
// ============================================================================

/**
 * Example showing AdminRoute used for conditional rendering
 * Useful for showing/hiding admin-only features
 */
export function Example5_ConditionalAdminContent() {
  return (
    <div className="container mx-auto p-6">
      <h1>Public Page</h1>
      <p>This content is visible to everyone</p>
      
      <AdminRoute>
        <div className="mt-6 border-t pt-6">
          <h2>Admin Only Section</h2>
          <p>This section is only visible to admins</p>
        </div>
      </AdminRoute>
    </div>
  )
}

// ============================================================================
// Example 6: Admin Layout Wrapper Component
// ============================================================================

/**
 * Reusable layout wrapper for all admin pages
 * Use this pattern to wrap all admin routes consistently
 */
interface AdminPageWrapperProps {
  children: React.ReactNode
  title?: string
}

export function AdminPageWrapper({ children, title }: AdminPageWrapperProps) {
  return (
    <AdminRoute>
      <AdminLayout>
        {title && (
          <div className="mb-6">
            <h1 className="text-3xl font-bold">{title}</h1>
          </div>
        )}
        {children}
      </AdminLayout>
    </AdminRoute>
  )
}

// Usage of AdminPageWrapper:
// export default function AdminDashboardPage() {
//   return (
//     <AdminPageWrapper title="Dashboard">
//       <div>Dashboard content here</div>
//     </AdminPageWrapper>
//   )
// }

