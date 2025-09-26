'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { ChatSidebar } from './chat-sidebar'
import { SimpleChat } from './simple-chat-final'
import { TenantLogo } from '@/components/tenant-logo'
import { ChevronDown, Bot, Settings, User, X, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

interface NewChatSession {
  id: string
  title: string
  botName?: string
}

export function ChatLayout({ tenant, user, initialBots = [] }: ChatLayoutProps) {
  const [selectedBot, setSelectedBot] = useState<Bot | null>(initialBots[0] || null)
  
  // Extract user's display name from email
  const userName = user?.email ? user.email.split('@')[0] : 'User'
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()
  const [availableBots, setAvailableBots] = useState<Bot[]>(initialBots)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Default to closed on mobile, open on desktop
  const [mounted, setMounted] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const [hasInitialSession, setHasInitialSession] = useState(false)
  const sessionCreationRef = useRef<Promise<void> | null>(null)
  const [newLocalSession, setNewLocalSession] = useState<NewChatSession | null>(null)
  
  // Set sidebar open by default on desktop
  useEffect(() => {
    setMounted(true)
    const handleResize = () => {
      if (window.innerWidth >= 1024) { // lg breakpoint
        setSidebarOpen(true)
      }
    }
    handleResize() // Set initial state
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  const supabase = createClient()

  useEffect(() => {
    loadBots()
  }, [tenant.id])
  
  // Create initial session when component mounts if no session exists
  // Only run once at the very beginning
  useEffect(() => {
    if (selectedBot && !currentSessionId && mounted && !hasInitialSession) {
      console.log('Creating initial session for bot:', selectedBot.id)
      setHasInitialSession(true)
      handleNewChat()
    }
  }, []) // Empty dependency array - only run once on mount

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

  const handleNewChat = async () => {
    if (!selectedBot) return
    
    // Prevent concurrent session creation
    if (sessionCreationRef.current) {
      console.log('⏳ Session creation already in progress, waiting...')
      await sessionCreationRef.current
      return
    }
    
    if (isCreatingSession) {
      console.log('🚫 Already creating session, skipping duplicate call')
      return
    }
    
    // Create a new session immediately
    const createSession = async () => {
      try {
        setIsCreatingSession(true)
        
        const response = await fetch('/api/session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            botId: selectedBot.id,
            tenantId: tenant.id,
            userId: user.id,
          }),
        })
        
        if (response.ok) {
          const data = await response.json()
          const newSessionId = data.sessionId
          
          console.log('✅ New session created:', newSessionId)
          
          // Set the new session ID - this will be passed to SimpleChat
          setCurrentSessionId(newSessionId)
          
          // Clear localStorage to prevent reusing old sessions
          const sessionKey = `sessionId:${selectedBot.id}`
          localStorage.removeItem(sessionKey)
        }
      } catch (error) {
        console.error('Failed to create new session:', error)
      } finally {
        setIsCreatingSession(false)
        sessionCreationRef.current = null
      }
    }
    
    sessionCreationRef.current = createSession()
    await sessionCreationRef.current
  }

  const handleSelectSession = (sessionId: string) => {
    setCurrentSessionId(sessionId)
    // Clear local session when selecting a different session
    if (newLocalSession?.id !== sessionId) {
      setNewLocalSession(null)
    }
  }
  
  const handleFirstMessage = (sessionId: string, messageText: string) => {
    // When first message is sent, update local state immediately
    console.log('📝 First message sent, updating sidebar:', sessionId, messageText)
    setNewLocalSession({
      id: sessionId,
      title: messageText.slice(0, 100),
      botName: selectedBot?.name
    })
  }

  const handleBotChange = async (bot: Bot) => {
    // Clear current session first
    setCurrentSessionId(undefined)
    setSelectedBot(bot)
    
    // Wait a tick to ensure state is updated
    setTimeout(() => {
      handleNewChat() // Start new chat when changing bot
    }, 0)
  }

  return (
    <div className="h-dvh w-screen overflow-hidden bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 fixed inset-0">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar - Chat History - Always fixed position */}
      <aside className={cn(
        "fixed top-0 left-0 z-40 w-[320px] h-full bg-[#171717] transition-transform duration-300 ease-in-out",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Chat History - Full height */}
        <div className="h-full overflow-hidden flex flex-col">
          <ChatSidebar
            tenantId={tenant.id}
            userId={user.id}
            userEmail={user.email}
            userName={userName}
            tenantName={tenant.name}
            tenantLogo={tenant.logo_url}
            currentSessionId={currentSessionId}
            currentBotName={selectedBot?.name}
            newLocalSession={newLocalSession}
            onNewChat={() => {
              handleNewChat()
              setNewLocalSession(null) // Clear local session on new chat
              setSidebarOpen(false) // Close sidebar on mobile after action
            }}
            onSelectSession={(id) => {
              handleSelectSession(id)
            }}
          />
        </div>
      </aside>

      {/* Main Chat Area - Takes full screen */}
      <main className={cn(
        "w-full h-full flex flex-col transition-all duration-300 overflow-hidden",
        sidebarOpen ? "lg:pl-[320px]" : "pl-0"
      )}>
        {/* Top Bar */}
        <div className="border-b border-gray-200 dark:border-gray-800 px-2 lg:px-4 py-2 lg:py-3 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center justify-between">
            {/* Bot Selector */}
            <div className="flex items-center gap-1 lg:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 lg:p-2"
              >
                <Menu className="h-5 w-5" />
              </Button>
              
              {mounted ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-1 lg:gap-2 px-2 lg:px-3 h-8 lg:h-10">
                      <Bot className="h-4 w-4" />
                      <span className="font-medium text-sm lg:text-base truncate max-w-[120px] lg:max-w-none">
                        {selectedBot?.name || 'Select a bot'}
                      </span>
                      <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
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
              ) : (
                <Button variant="ghost" className="gap-1 lg:gap-2 px-2 lg:px-3 h-8 lg:h-10" disabled>
                  <Bot className="h-4 w-4" />
                  <span className="font-medium text-sm lg:text-base truncate max-w-[120px] lg:max-w-none">
                    Loading...
                  </span>
                </Button>
              )}

              {selectedBot?.description && (
                <span className="text-sm text-gray-500 hidden xl:block">
                  {selectedBot.description}
                </span>
              )}
            </div>

            {/* User Menu - Desktop only full menu, mobile simplified */}
            {mounted ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 lg:gap-2 px-2 lg:px-3 h-8 lg:h-10">
                    <User className="h-4 w-4" />
                    <span className="text-sm hidden sm:inline truncate max-w-[150px]">{user.email}</span>
                    <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4 hidden sm:inline" />
                  </Button>
                </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="sm:hidden">
                  <div className="text-xs truncate">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuLabel className="hidden sm:block">Account</DropdownMenuLabel>
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
            ) : (
              <Button variant="ghost" size="sm" className="gap-1 lg:gap-2 px-2 lg:px-3 h-8 lg:h-10" disabled>
                <User className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Chat Component */}
        <div className="flex-1 overflow-hidden min-h-0">
          {selectedBot ? (
            <SimpleChat
              key={`${selectedBot.id}-${currentSessionId || 'new'}`}
              botName={selectedBot.name}
              botId={selectedBot.id}
              userId={user.id}
              tenantId={tenant.id}
              sessionId={currentSessionId}
              className="h-full"
              onNewChat={handleNewChat}
              onFirstMessage={handleFirstMessage}
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
      </main>
    </div>
  )
}