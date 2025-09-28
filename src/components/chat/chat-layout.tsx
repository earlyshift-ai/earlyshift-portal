'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { ChatSidebar } from './chat-sidebar'
import { SimpleChat } from './simple-chat-final'
import { TenantLogo } from '@/components/tenant-logo'
import { ChevronDown, Bot, X, Menu } from 'lucide-react'
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
  userProfile?: {
    full_name?: string
    avatar_url?: string
  } | null
  initialBots?: Bot[]
}

interface NewChatSession {
  id: string
  title: string
  botName?: string
}

export function ChatLayout({ tenant, user, userProfile, initialBots = [] }: ChatLayoutProps) {
  const [selectedBot, setSelectedBot] = useState<Bot | null>(initialBots[0] || null)
  
  // Use full name from profile, fallback to email prefix, then 'User'
  const userName = userProfile?.full_name || (user?.email ? user.email.split('@')[0] : 'User')
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>()
  const [availableBots, setAvailableBots] = useState<Bot[]>(initialBots)
  const [sidebarOpen, setSidebarOpen] = useState(false) // Default to closed on mobile, open on desktop
  const [mounted, setMounted] = useState(false)
  const [isCreatingSession, setIsCreatingSession] = useState(false)
  const sessionCreationRef = useRef<Promise<string | null> | null>(null)
  const [newLocalSession, setNewLocalSession] = useState<NewChatSession | null>(null)
  const [sessionHasMessages, setSessionHasMessages] = useState(false)
  const [isNewChatMode, setIsNewChatMode] = useState(false) // Track if we're in "new chat" mode
  
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

  // Check if current session has messages to lock bot selection
  useEffect(() => {
    const checkSessionMessages = async () => {
      if (!currentSessionId) {
        console.log('🔓 No currentSessionId - unlocking bot selector')
        setSessionHasMessages(false)
        return
      }
      
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('id')
          .eq('session_id', currentSessionId)
          .limit(1)
          
        if (!error && data && data.length > 0) {
          console.log('🔒 Session has messages - locking bot selector')
          setSessionHasMessages(true)
        } else {
          console.log('🔓 Session has no messages - unlocking bot selector')
          setSessionHasMessages(false)
        }
      } catch (error) {
        console.error('Error checking session messages:', error)
        setSessionHasMessages(false)
      }
    }
    
    checkSessionMessages()
  }, [currentSessionId, supabase])
  
  const loadBots = async () => {
    try {
      const { data: userBots } = await supabase
        .rpc('get_user_accessible_bots', { 
          p_user_id: user.id,
          p_tenant_id: tenant.id 
        })

      const bots = userBots?.map((bot: any) => ({
        id: bot.bot_id,
        name: bot.bot_name,
        description: bot.bot_description,
        model_config: bot.model_config
      })) || []
      
      setAvailableBots(bots as Bot[])
      
      if (bots.length > 0 && !selectedBot) {
        setSelectedBot(bots[0] as Bot)
      }
    } catch (error) {
      console.error('Error loading bots:', error)
    }
  }

  const handleNewChat = async () => {
    console.log('🆕 Parent handleNewChat called - creating session for first message')
    
    if (!selectedBot) {
      console.error('❌ No bot selected, cannot create session')
      return null
    }
    
    // Prevent concurrent session creation
    if (sessionCreationRef.current) {
      console.log('⏳ Session creation already in progress, waiting...')
      const existingSession = await sessionCreationRef.current
      return existingSession
    }
    
    if (isCreatingSession) {
      console.log('⏳ Already creating session, waiting...')
      // Wait a bit and retry
      await new Promise(resolve => setTimeout(resolve, 100))
      return handleNewChat()
    }
    
    // Create a new session with retry logic
    const createSession = async () => {
      let retries = 3
      
      while (retries > 0) {
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
            setIsNewChatMode(false) // No longer in new chat mode
            
            // Clear ALL bot session keys from localStorage to ensure clean state
            availableBots.forEach(bot => {
              const sessionKey = `sessionId:${bot.id}`
              localStorage.removeItem(sessionKey)
            })
            
            return newSessionId
          } else {
            console.error(`Failed to create session: ${response.status} - Retries left: ${retries - 1}`)
            retries--
            if (retries > 0) {
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
        } catch (error) {
          console.error(`Failed to create new session: ${error} - Retries left: ${retries - 1}`)
          retries--
          if (retries > 0) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        }
      }
      
      // All retries failed
      console.error('❌ Failed to create session after 3 retries')
      setIsCreatingSession(false)
      sessionCreationRef.current = null
      return null
    }
    
    sessionCreationRef.current = createSession()
    const result = await sessionCreationRef.current
    
    // Clean up after completion
    setIsCreatingSession(false)
    sessionCreationRef.current = null
    
    return result || null
  }

  const handleSelectSession = async (sessionId: string) => {
    console.log('📂 Selecting session:', sessionId)
    setCurrentSessionId(sessionId)
    setIsNewChatMode(false) // Not in new chat mode when selecting existing session
    
    // Clear local session when selecting a different session
    if (newLocalSession?.id !== sessionId) {
      setNewLocalSession(null)
    }
    
    // Get the bot associated with this session and update selected bot
    try {
      const { data: session, error } = await supabase
        .from('chat_sessions')
        .select(`
          bot_id,
          bots!inner (
            id,
            name,
            description,
            model_config
          )
        `)
        .eq('id', sessionId)
        .single()
        
      if (!error && session?.bots) {
        const botData = session.bots as any
        const sessionBot = {
          id: botData.id,
          name: botData.name,
          description: botData.description,
          model_config: botData.model_config
        }
        setSelectedBot(sessionBot as Bot)
        
        // Clear all localStorage sessions to prevent conflicts
        availableBots.forEach(bot => {
          const sessionKey = `sessionId:${bot.id}`
          localStorage.removeItem(sessionKey)
        })
      }
    } catch (error) {
      console.error('Error getting session bot:', error)
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
    
    // Lock the bot selector immediately when a message is sent
    setSessionHasMessages(true)
    setIsNewChatMode(false) // No longer in new chat mode after first message
  }

  const handleBotChange = async (bot: Bot) => {
    console.log('🤖 Changing bot to:', bot.name)
    
    // If we're in new chat mode (no messages sent yet), just switch the bot
    if (isNewChatMode || (!currentSessionId && !sessionHasMessages)) {
      console.log('🔄 Switching bot in new chat mode')
      setSelectedBot(bot)
      // Stay in new chat mode
      return
    }
    
    // If we have a session with messages, clear everything for new bot
    setSelectedBot(bot)
    setSessionHasMessages(false)
    setNewLocalSession(null)
    setCurrentSessionId(undefined)
    setIsNewChatMode(true) // Enter new chat mode
    
    // Clear ALL localStorage sessions to ensure clean state
    availableBots.forEach(b => {
      const sessionKey = `sessionId:${b.id}`
      localStorage.removeItem(sessionKey)
    })
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
              // Clear current session - new one will be created when user sends first message
              console.log('🆕 Sidebar New Chat clicked - entering new chat mode')
              setCurrentSessionId(undefined)
              setSessionHasMessages(false)
              setNewLocalSession(null)
              setIsNewChatMode(true) // Enter new chat mode
              setSidebarOpen(false) // Close sidebar on mobile after action
              
              // Clear ALL localStorage sessions to ensure clean state
              availableBots.forEach(bot => {
                const sessionKey = `sessionId:${bot.id}`
                localStorage.removeItem(sessionKey)
              })
              
              // Clear localStorage to force useSessionId to create a fresh session
              if (selectedBot) {
                const sessionKey = `sessionId:${selectedBot.id}`
                localStorage.removeItem(sessionKey)
              }
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
                    <Button 
                      variant="ghost" 
                      className="gap-1 lg:gap-2 px-2 lg:px-3 h-8 lg:h-10"
                      disabled={sessionHasMessages}
                    >
                      <Bot className="h-4 w-4" />
                      <span className="font-medium text-sm lg:text-base truncate max-w-[120px] lg:max-w-none">
                        {selectedBot?.name || 'Select a bot'}
                      </span>
                      {sessionHasMessages ? (
                        <div className="text-xs text-gray-500 ml-1" title="Bot locked for this conversation">🔒</div>
                      ) : (
                        <ChevronDown className="h-3 w-3 lg:h-4 lg:w-4" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  {!sessionHasMessages && (
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
                  )}
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

          </div>
        </div>

        {/* Chat Component */}
        <div className="flex-1 overflow-hidden min-h-0">
          {selectedBot ? (
            <SimpleChat
              key={`chat-${selectedBot.id}-${currentSessionId || 'new'}-${isNewChatMode ? 'new-mode' : 'existing'}`}
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