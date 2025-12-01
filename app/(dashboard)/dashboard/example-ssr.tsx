/**
 * Example Server Component with Supabase Session
 * 
 * This demonstrates:
 * - Using createServerComponentClient() for SSR
 * - Reading user session on the server
 * - Redirecting unauthenticated users
 * - Accessing user data without client-side API calls
 */

import { redirect } from 'next/navigation'
import { createServerComponentClient } from '@/lib/auth/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function ExampleSSRPage() {
  // Create Supabase client for Server Component
  const supabase = await createServerComponentClient()
  
  // Get user session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // Redirect if not authenticated
  if (userError || !user) {
    redirect('/login')
  }

  // Get user role from database
  const { data: userRole } = await supabase
    .from('user_roles')
    .select('role, approved, clinic_id')
    .eq('user_id', user.id)
    .single()

  // This component renders on the server
  // No client-side JavaScript needed for auth check
  return (
    <div className="container mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Server-Side Rendered Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">User ID</p>
              <p className="font-mono text-sm">{user.id}</p>
            </div>
            {userRole && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium capitalize">{userRole.role}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clinic ID</p>
                  <p className="font-mono text-sm">{userRole.clinic_id || 'Not assigned'}</p>
                </div>
                {userRole.role === 'doctor' && (
                  <div>
                    <p className="text-sm text-muted-foreground">Approval Status</p>
                    <p className="font-medium">
                      {userRole.approved ? 'Approved' : 'Pending Approval'}
                    </p>
                  </div>
                )}
              </>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Email Verified</p>
              <p className="font-medium">
                {user.email_confirmed_at ? 'Verified' : 'Not Verified'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Alternative approach using getSession():
 * 
 * import { getSession } from '@/lib/auth/supabase'
 * 
 * export default async function ExampleSSRPage() {
 *   const { session, user, error } = await getSession({ type: 'server-component' })
 *   
 *   if (error || !user) {
 *     redirect('/login')
 *   }
 *   
 *   return <div>Welcome {user.email}</div>
 * }
 */

