'use client'

import { useState, useEffect } from 'react'
import { ChatSidebar } from './chat-sidebar'
import { SimpleChat } from './simple-chat-final'
import { TenantLogo } from '@/components/tenant-logo'
import { ChevronDown, Bot, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

interface Bot {
  id: string
  name: string
  description?: string
  model_config: any
}

interface ChatLayoutProps {
  tenant: any
  user: any
  initialBots?: Bot[]
}

export function ChatLayout({ tenant, user, initialBots = [] }: ChatLayoutProps) {
  const [selectedBot, setSelectedBot] = useState<Bot | null>(initialBots[0] || null)
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()
  const [availableBots, setAvailableBots] = useState<Bot[]>(initialBots)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [key, setKey] = useState(0) // Key to force re-render chat component
  
  const supabase = createClient()

  useEffect(() => {
    loadBots()
  }, [tenant.id])

  const loadBots = async () => {
    try {
      const { data: botAccess } = await supabase
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
        .eq('tenant_id', tenant.id)
        .eq('enabled', true)

      const bots = botAccess?.map(access => access.bots).filter(Boolean) || []
      setAvailableBots(bots as Bot[])
      
      if (bots.length > 0 && !selectedBot) {
        setSelectedBot(bots[0] as Bot)
      }
    } catch (error) {
      console.error('Error loading bots:', error)
    }
  }

  const handleNewChat = () => {
    setCurrentSessionId(undefined)
    setKey(prev => prev + 1) // Force re-render to create new session
  }

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    setKey(prev => prev + 1) // Force re-render with new session
  }

  const handleBotChange = (bot: Bot) => {
    setSelectedBot(bot)
    handleNewChat() // Start new chat when changing bot
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950">
      {/* Left Sidebar - Chat History */}
      {sidebarOpen && (
        <div className="w-64 border-r border-gray-200 dark:border-gray-800 flex flex-col">
          {/* Tenant Logo */}
          <div className="p-3 border-b border-gray-800">
            <TenantLogo size="sm" showName={true} />
          </div>
          
          {/* Chat History */}
          <div className="flex-1">
            <ChatSidebar
              tenantId={tenant.id}
              userId={user.id}
              currentSessionId={currentSessionId}
              onNewChat={handleNewChat}
              onSelectSession={handleSelectSession}
            />
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Bot Selector */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${sidebarOpen ? 'rotate-90' : ''}`} />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <Bot className="h-4 w-4" />
                    <span className="font-medium">
                      {selectedBot?.name || 'Select a bot'}
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuLabel>Available Bots</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableBots.map(bot => (
                    <DropdownMenuItem
                      key={bot.id}
                      onClick={() => handleBotChange(bot)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <Bot className="h-4 w-4 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-medium">{bot.name}</div>
                          {bot.description && (
                            <div className="text-xs text-gray-500 line-clamp-2">
                              {bot.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  {availableBots.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">
                      No bots available
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedBot?.description && (
                <span className="text-sm text-gray-500 hidden lg:block">
                  {selectedBot.description}
                </span>
              )}
            </div>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{user.email}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Chat Component */}
        <div className="flex-1 overflow-hidden">
          {selectedBot ? (
            <SimpleChat
              key={key}
              botName={selectedBot.name}
              botId={selectedBot.id}
              userId={user.id}
              tenantId={tenant.id}
              sessionId={currentSessionId}
              className="h-full"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-gray-500">
                <Bot className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">No Bot Selected</h3>
                <p className="text-sm">Please select a bot from the dropdown above to start chatting.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}