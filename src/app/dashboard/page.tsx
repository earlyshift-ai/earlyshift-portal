import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatLayout } from '@/components/chat/chat-layout'
import { TenantProvider } from '@/components/tenant-provider'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    redirect('/auth/login')
  }

  // Get user's tenant memberships
  const { data: memberships, error: membershipError } = await supabase
    .rpc('get_user_memberships', { user_uuid: user.id })

  if (membershipError || !memberships || memberships.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            No Company Access
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have access to any companies yet. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  // Use the user's single tenant (users only have one company)
  const membership = memberships[0]
  
  // Get tenant details
  const { data: tenant, error: tenantError } = await supabase
    .rpc('get_tenant_by_slug', { tenant_slug: membership.tenant_slug })
    .single()

  if (tenantError || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Tenant Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            The tenant could not be loaded. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  // Get bots that this tenant has access to
  const { data: botAccess, error: botAccessError } = await supabase
    .from('bot_access')
    .select(`
      *,
      bots (
        id,
        name,
        description,
        model_config
      )
    `)
    .eq('tenant_id', (tenant as any).id)
    .eq('enabled', true)

  const availableBots = botAccess?.map(access => access.bots).filter(Boolean) || []

  return (
    <TenantProvider initialTenant={tenant as any}>
      <ChatLayout 
        tenant={tenant as any}
        user={user}
        initialBots={availableBots as any}
      />
    </TenantProvider>
  )
}
