import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TenantSelectorClient } from '@/components/tenant-selector-client'

export default async function SelectCompanyPage() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/auth/login')
  }

  // Get user's tenant memberships
  const { data: memberships, error: membershipError } = await supabase
    .rpc('get_user_memberships', { user_uuid: user.id })

  if (membershipError) {
    console.error('Error fetching memberships:', membershipError)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Error Loading Companies
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            There was an error loading your company access. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  // If no memberships, show no access message
  if (!memberships || memberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            No Company Access
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don&apos;t have access to any companies yet. Please contact your administrator to get access.
          </p>
          <p className="text-sm text-gray-500">
            User: {user.email}
          </p>
        </div>
      </div>
    )
  }

  // Use client component to handle tenant selection and redirects
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TenantSelectorClient 
        memberships={memberships}
        userEmail={user.email || 'User'}
      />
    </div>
  )
}
