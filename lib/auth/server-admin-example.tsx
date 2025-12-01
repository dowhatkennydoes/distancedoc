/**
 * Example Usage of getServerAdmin() Helper
 * 
 * This file demonstrates how to use getServerAdmin() and requireServerAdmin()
 * in Next.js Server Components for admin route protection.
 */

import { getServerAdmin, requireServerAdmin } from './utils'
import { redirect } from 'next/navigation'

// ============================================================================
// Example 1: Using requireServerAdmin() - Automatic Redirect
// ============================================================================

/**
 * Example Server Component with automatic redirect
 * If user is not admin, automatically redirects to /login
 * 
 * Usage:
 * ```tsx
 * export default async function AdminDashboardPage() {
 *   const user = await requireServerAdmin()
 *   // User is guaranteed to be admin here
 *   return <div>Welcome, {user.email}</div>
 * }
 * ```
 */
export async function Example1_RequireServerAdmin() {
  // This will automatically redirect to /login if not authenticated or not admin
  const user = await requireServerAdmin()
  
  // TypeScript knows user is definitely an admin at this point
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p>Welcome, {user.email}</p>
      <p>Role: {user.role}</p>
      <p>Clinic ID: {user.clinicId}</p>
    </div>
  )
}

// ============================================================================
// Example 2: Using getServerAdmin() - Manual Redirect Handling
// ============================================================================

/**
 * Example Server Component with manual redirect handling
 * More control over redirect logic
 * 
 * Usage:
 * ```tsx
 * export default async function AdminSettingsPage() {
 *   const adminCheck = await getServerAdmin()
 *   
 *   if (!adminCheck.allowed) {
 *     if (adminCheck.reason === 'unauthenticated') {
 *       redirect('/login')
 *     } else {
 *       redirect('/dashboard') // User is authenticated but not admin
 *     }
 *   }
 *   
 *   const user = adminCheck.user
 *   return <div>Settings for {user.email}</div>
 * }
 * ```
 */
export async function Example2_GetServerAdmin() {
  const adminCheck = await getServerAdmin()
  
  // Handle different failure reasons
  if (!adminCheck.allowed) {
    if (adminCheck.reason === 'unauthenticated') {
      // User is not logged in - redirect to login
      redirect('/login')
    } else {
      // User is logged in but not admin - redirect to their dashboard
      redirect('/dashboard')
    }
  }
  
  // TypeScript knows adminCheck.user exists because allowed is true
  const user = adminCheck.user!
  
  return (
    <div>
      <h1>Admin Settings</h1>
      <p>Welcome, {user.email}</p>
    </div>
  )
}

// ============================================================================
// Example 3: Using getServerAdmin() - Custom Error Handling
// ============================================================================

/**
 * Example Server Component with custom error handling
 * Shows loading state or error message instead of redirect
 * 
 * Usage:
 * ```tsx
 * export default async function AdminReportsPage() {
 *   const adminCheck = await getServerAdmin()
 *   
 *   if (!adminCheck.allowed) {
 *     return (
 *       <div>
 *         <h1>Access Denied</h1>
 *         <p>
 *           {adminCheck.reason === 'unauthenticated'
 *             ? 'Please log in to continue'
 *             : 'You do not have permission to access this page'}
 *         </p>
 *       </div>
 *     )
 *   }
 *   
 *   return <div>Admin Reports</div>
 * }
 * ```
 */
export async function Example3_CustomErrorHandling() {
  const adminCheck = await getServerAdmin()
  
  if (!adminCheck.allowed) {
    return (
      <div>
        <h1>Access Denied</h1>
        <p>
          {adminCheck.reason === 'unauthenticated'
            ? 'Please log in to continue'
            : 'You do not have permission to access this page'}
        </p>
      </div>
    )
  }
  
  const user = adminCheck.user!
  
  return (
    <div>
      <h1>Admin Reports</h1>
      <p>Generating reports for {user.email}</p>
    </div>
  )
}

// ============================================================================
// Example 4: Using in API Route (Server Action)
// ============================================================================

/**
 * Example Server Action with admin check
 * 
 * Usage:
 * ```tsx
 * 'use server'
 * 
 * import { requireServerAdmin } from '@/lib/auth/utils'
 * 
 * export async function deleteUser(userId: string) {
 *   const admin = await requireServerAdmin()
 *   // Admin is guaranteed here - proceed with deletion
 *   // ... deletion logic
 * }
 * ```
 */
export async function Example4_ServerAction() {
  // This would be a 'use server' function
  const admin = await requireServerAdmin()
  
  // Admin operations here
  return { success: true, adminId: admin.id }
}

// ============================================================================
// Example 5: Full Admin Page Implementation
// ============================================================================

/**
 * Complete example of an admin page using the helper
 * This shows a real-world implementation
 */
export async function Example5_FullAdminPage() {
  // Check admin access - will redirect if not allowed
  const user = await requireServerAdmin()
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {user.email}
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Users</h2>
          <p className="text-muted-foreground">Manage users and permissions</p>
        </div>
        
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Settings</h2>
          <p className="text-muted-foreground">Configure system settings</p>
        </div>
        
        <div className="border rounded-lg p-4">
          <h2 className="text-xl font-semibold mb-2">Reports</h2>
          <p className="text-muted-foreground">View system reports</p>
        </div>
      </div>
    </div>
  )
}

