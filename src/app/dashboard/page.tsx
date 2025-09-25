import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SimpleChat } from '@/components/chat/simple-chat-final'
import { TenantProvider } from '@/components/tenant-provider'
import { TenantLogo } from '@/components/tenant-logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare, Users, Zap } from 'lucide-react'

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
    redirect('/select-company')
  }

  // If multiple tenants, redirect to selection page (should be handled by middleware)
  if (memberships.length > 1) {
    redirect('/select-company')
  }

  // Use the single tenant
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
  const selectedBot = availableBots[0] // Use first available bot for now

  // Get user's chat sessions count
  const { count: sessionsCount } = await supabase
    .from('chat_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', (tenant as any).id)
    .eq('user_id', user.id)
    .eq('status', 'active')

  // Get total team members count
  const { count: membersCount } = await supabase
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', (tenant as any).id)
    .eq('status', 'active')

  return (
    <TenantProvider initialTenant={tenant as any}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center gap-4">
                <TenantLogo size="md" showName={true} />
                <div className="hidden sm:block text-gray-400">|</div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                    AI Assistant Dashboard
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Welcome back, {user.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs rounded-full text-white`} style={{ backgroundColor: (tenant as any).primary_color }}>
                  {membership.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Stats Cards */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Available Bots</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{availableBots.length}</div>
                  <p className="text-xs text-muted-foreground">
                    AI agents ready to help
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{sessionsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {sessionsCount === 1 ? 'Current conversation' : 'Chat sessions created'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{membersCount || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Users in {(tenant as any).name}
                  </p>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">About Your Bots</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    Your AI agents are powered by n8n workflows and can handle complex data operations.
                  </p>
                  <p>
                    Select a bot from the dropdown to start a conversation.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Chat Interface */}
            <div className="lg:col-span-3">
              <Card className="h-[600px]">
                <CardContent className="p-0 h-full">
                  {selectedBot ? (
                    <SimpleChat 
                      botName={(selectedBot as any).name}
                      botId={(selectedBot as any).id}
                      userId={(user as any)?.id}
                      tenantId={(tenant as any).id}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Bots Available</h3>
                        <p className="text-gray-600">No AI assistants are configured for your account.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </TenantProvider>
  )
}
