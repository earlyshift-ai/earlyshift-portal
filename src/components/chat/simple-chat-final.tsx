'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Clock } from 'lucide-react'
import { useSessionId } from '@/hooks/use-session-id'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  latency?: number
  botName?: string
  botId?: string
}

interface SimpleChatProps {
  botName: string
  botId?: string
  userId?: string
  tenantId?: string
  sessionId?: string
  className?: string
  onNewChat?: () => Promise<string | null>
  onFirstMessage?: (sessionId: string, messageText: string) => void
}

export function SimpleChat({ 
  botName, 
  botId,
  userId = 'current-user',
  tenantId,
  sessionId: externalSessionId,
  className = '',
  onNewChat,
  onFirstMessage
}: SimpleChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasUserMessage, setHasUserMessage] = useState(false)
  const [pendingAssistantMessageId, setPendingAssistantMessageId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Session management - NEVER use the hook when we have an external session (even undefined)
  // Only use the hook if botId is provided and NO external session prop exists
  const shouldUseHook = false // Always false to prevent hook conflicts with parent management
  console.log('🔧 SimpleChat session logic:', { externalSessionId, botId, shouldUseHook })
  
  const { 
    sessionId: generatedSessionId, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    refresh: refreshSession,
    clearSession 
  } = useSessionId(shouldUseHook ? botId : undefined, shouldUseHook ? tenantId : undefined)
  
  // Use external session ID directly, even if undefined (for new chat mode)
  const sessionId = externalSessionId

  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Track previous sessionId to detect changes
  const prevSessionIdRef = useRef<string | undefined>(sessionId)
  
  // Load messages and setup Realtime subscription
  useEffect(() => {
    const prevSessionId = prevSessionIdRef.current
    prevSessionIdRef.current = sessionId
    
    // Clean up previous subscription immediately when sessionId changes
    if (channelRef.current) {
      console.log('🔌 Cleaning up previous subscription')
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
    
    if (!sessionId) {
      // Only clear messages if we're moving FROM a session to no session
      // Not when we start with no session (new chat mode)
      if (prevSessionId) {
        console.log('🧹 Moving to no session - clearing messages and state')
        setMessages([])
        setHasUserMessage(false)
        setIsProcessing(false)
      }
      setIsLoadingHistory(false) // Not loading when no session
      return
    }

    const setupChat = async () => {
      console.log('🔧 Setting up chat for session:', sessionId)
      
      // Only clear messages if we're switching between different existing sessions
      // Don't clear when going from undefined -> sessionId (new session creation)
      const isNewSessionCreation = !prevSessionId && sessionId
      
      if (!isNewSessionCreation) {
        // Clear state only when switching between sessions
        setMessages([])
        setHasUserMessage(false)
        setIsProcessing(false)
      }
      // For new session creation, preserve the temporary user message
      
      // Load existing messages only if not a new session creation
      if (!isNewSessionCreation) {
        try {
          setIsLoadingHistory(true)
          
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })

          if (error) throw error

          const formattedMessages: Message[] = data
            .filter((msg: any) => msg.role !== 'system') // Filter out system messages
            .map((msg: any) => ({
              id: msg.id,
              content: msg.content || '',
              role: msg.role as 'user' | 'assistant',
              timestamp: new Date(msg.created_at),
              latency: msg.latency_ms,
              botName: msg.metadata?.bot_name || (msg.role === 'assistant' ? botName : undefined),
              botId: msg.metadata?.bot_id || (msg.role === 'assistant' ? botId : undefined),
            }))

          setMessages(formattedMessages)
          // Check if there are user messages
          setHasUserMessage(formattedMessages.some(m => m.role === 'user'))
        } catch (error) {
          console.error('Failed to load messages:', error)
        } finally {
          setIsLoadingHistory(false)
        }
      } else {
        // For new session, just mark as not loading
        setIsLoadingHistory(false)
        setHasUserMessage(true) // We have a user message from the form submission
      }

      // Add a small delay before setting up Realtime to ensure session is fully created in database
      // This helps prevent missing the initial assistant placeholder message
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // Set up Realtime subscription with unique channel name
      console.log('🔌 Setting up Realtime for session:', sessionId)
      const channelName = `chat-${sessionId}-${Date.now()}` // Unique channel name
      
      channelRef.current = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            console.log('📨 Realtime INSERT:', payload)
            
            const newMessage = {
              id: payload.new.id,
              content: payload.new.content || '',
              role: payload.new.role as 'user' | 'assistant',
              timestamp: new Date(payload.new.created_at),
              latency: payload.new.latency_ms,
              botName: payload.new.metadata?.bot_name || (payload.new.role === 'assistant' ? botName : undefined),
              botId: payload.new.metadata?.bot_id || (payload.new.role === 'assistant' ? botId : undefined),
            }
            
            // Add the new message
            setMessages(prev => {
                // Skip system messages
                if (payload.new.role === 'system') {
                  return prev
                }
                
                // Check if this is a duplicate of our temp message
                if (newMessage.role === 'user') {
                  // Check for temp message with similar content (normalize comparison)
                  const tempMessage = prev.find(m => 
                    m.id.startsWith('temp-') && 
                    m.role === 'user' &&
                    m.content.trim().toLowerCase() === newMessage.content.trim().toLowerCase()
                  )
                  
                  if (tempMessage) {
                    // Replace the temp message with the real one
                    console.log('🔄 Replacing temp user message with real one')
                    return prev.map(m => 
                      m.id === tempMessage.id
                        ? { ...newMessage } // Replace with real message
                        : m
                    )
                  }
                  
                  // Also check if it's a duplicate by content (within last 5 seconds)
                  const recentDuplicate = prev.find(m => 
                    m.role === 'user' &&
                    m.content.trim().toLowerCase() === newMessage.content.trim().toLowerCase() &&
                    (new Date().getTime() - m.timestamp.getTime()) < 5000
                  )
                  
                  if (recentDuplicate) {
                    console.log('⏭️ Duplicate user message, skipping:', newMessage.id)
                    return prev
                  }
                }
                
                // Check if message already exists by ID
                const existsById = prev.some(m => m.id === newMessage.id)
                if (existsById) {
                  console.log('⏭️ Message already exists, skipping:', newMessage.id)
                  return prev
                }
                
                // Add new message
                console.log('➕ Adding new message:', newMessage.role, newMessage.id)
                return [...prev, newMessage]
              })
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            console.log('🔄 Realtime UPDATE:', payload)
            
            setMessages(prev => 
              prev.map(msg => {
                if (msg.id === payload.new.id) {
                  console.log('📝 Updating message:', msg.id)
                  return {
                    ...msg,
                    content: payload.new.content || msg.content,
                    latency: payload.new.latency_ms || msg.latency,
                  }
                }
                return msg
              })
            )
            
            // If it's an assistant message being completed or has actual content, we're done processing
            if (payload.new.role === 'assistant') {
              // Clear processing state if message is completed or has real content (not placeholder)
              if (payload.new.status === 'completed' || 
                  (payload.new.content && !payload.new.content.includes('Procesando tu consulta'))) {
                console.log('✅ Assistant response received/completed')
                setIsProcessing(false)
                setPendingAssistantMessageId(null)
                // Clear the timeout since we got a response
                if (processingTimeoutRef.current) {
                  clearTimeout(processingTimeoutRef.current)
                  processingTimeoutRef.current = null
                }
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime status:', status)
        })
    }

    setupChat()

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        console.log('🔌 Cleaning up Realtime')
        channelRef.current.unsubscribe()
      }
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [sessionId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputValue.trim() || isProcessing) return

    const messageText = inputValue.trim()
    setInputValue('')
    setIsProcessing(true)
    
    // Add user message immediately (optimistic update) - BEFORE session creation
    const tempUserId = `temp-${Date.now()}`
    const userMessage: Message = {
      id: tempUserId,
      content: messageText,
      role: 'user',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    
    // If no session exists, create one first
    let activeSessionId = sessionId
    if (!activeSessionId && onNewChat) {
      console.log('🆕 No session exists, creating new session for first message')
      const newSessionId = await onNewChat()
      activeSessionId = newSessionId ?? undefined
      if (!activeSessionId) {
        console.error('❌ Failed to create session after retries')
        setIsProcessing(false)
        setInputValue(messageText) // Restore input
        
        // Replace user message with error
        setMessages([{
          id: `error-${Date.now()}`,
          content: 'Lo siento, hubo un problema al crear la sesión. Por favor, intenta nuevamente.',
          role: 'assistant',
          timestamp: new Date(),
        }])
        return
      }
      // IMPORTANT: Don't clear messages here - keep the user message visible
    }
    
    if (!activeSessionId) {
      console.error('❌ No session ID available')
      setIsProcessing(false)
      setInputValue(messageText) // Restore input
      setMessages([]) // Clear the temp message
      return
    }
    
    // If this is the first user message, notify parent to update sidebar
    if (!hasUserMessage && onFirstMessage) {
      console.log('📝 First message in session, notifying parent')
      onFirstMessage(activeSessionId, messageText)
      setHasUserMessage(true)
    }
    
    try {
      // Send to backend first - it will handle inserting the user message
      const response = await fetch('/api/chat-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          text: messageText,
          userId,
          botId,
          botName,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status}`)
      }
      
      // The response will come through Realtime
      console.log('📤 Message sent, waiting for response via Realtime')
      
      // Parse response to get assistant message ID if available
      const responseData = await response.json()
      if (responseData.assistantMessageId) {
        setPendingAssistantMessageId(responseData.assistantMessageId)
      }
      
      // Set up a fallback polling mechanism to check for missed messages
      // This helps if Realtime subscription misses the initial message
      let pollCount = 0
      const maxPolls = 10
      const pollIntervalRef = { current: null as NodeJS.Timeout | null }
      
      pollIntervalRef.current = setInterval(async () => {
        pollCount++
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          return
        }
        
        // Try to fetch the assistant message directly
        if (responseData.assistantMessageId) {
          const { data: assistantMsg } = await supabase
            .from('messages')
            .select('*')
            .eq('id', responseData.assistantMessageId)
            .single()
            
          if (assistantMsg && assistantMsg.content && !assistantMsg.content.includes('Procesando tu consulta')) {
            console.log('📨 Found assistant message via polling')
            // Add message if not already present
            setMessages(prev => {
              const exists = prev.some(m => m.id === assistantMsg.id)
              if (!exists) {
                const newMessage = {
                  id: assistantMsg.id,
                  content: assistantMsg.content,
                  role: 'assistant' as const,
                  timestamp: new Date(assistantMsg.created_at),
                  latency: assistantMsg.latency_ms,
                  botName: assistantMsg.metadata?.bot_name || botName,
                  botId: assistantMsg.metadata?.bot_id || botId,
                }
                return [...prev, newMessage]
              }
              return prev
            })
            setIsProcessing(false)
            setPendingAssistantMessageId(null)
            if (processingTimeoutRef.current) {
              clearTimeout(processingTimeoutRef.current)
              processingTimeoutRef.current = null
            }
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
          }
        }
      }, 2000) // Poll every 2 seconds
      
      // Set up a fallback timeout to clear processing state if we don't get a response
      // This prevents the UI from getting stuck if Realtime fails
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
      processingTimeoutRef.current = setTimeout(() => {
        console.log('⏱️ Response timeout - clearing processing state')
        setIsProcessing(false)
        setPendingAssistantMessageId(null)
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current) // Also clear polling
      }, 30000) // 30 seconds timeout
      
    } catch (error) {
      console.error('❌ Failed to send message:', error)
      setIsProcessing(false)
      setPendingAssistantMessageId(null)
    }
  }


  // Only show loading if we're actually loading history for an existing session
  // Don't show loading for new chat mode (when sessionId is undefined)
  if (sessionId && isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Cargando historial...
      </div>
    )
  }

  if (sessionError) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        Error: {sessionError}
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full w-full bg-white dark:bg-gray-950 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base lg:text-lg font-semibold">{botName}</h2>
          {isProcessing && (
            <span className="text-xs lg:text-sm text-gray-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Analizando...</span>
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 lg:px-4 pb-2 min-h-0">
        <div className="max-w-3xl mx-auto">
          {messages.map((message, index) => (
            <div key={message.id} className="mb-4 lg:mb-6">
              {message.role === 'user' ? (
                // User message - aligned to right
                <div className="flex justify-end">
                  <div className="max-w-[90%] lg:max-w-[85%] text-right">
                    <div className="inline-block text-left bg-gray-100 dark:bg-gray-800 rounded-2xl px-3 lg:px-4 py-2 lg:py-3">
                      <p className="text-[14px] lg:text-[16px] leading-relaxed text-gray-900 dark:text-gray-100">
                        {message.content}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                // Assistant message - full width in center
                <div className="w-full">
                  {/* Bot name indicator */}
                  {message.botName && (
                    <div className="text-[10px] lg:text-xs text-blue-600 dark:text-blue-400 mb-1 font-medium flex items-center gap-1">
                      <span>🤖</span>
                      {message.botName}
                    </div>
                  )}
                  
                  {/* Thinking time indicator */}
                  {message.latency && (
                    <div className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 mb-1 lg:mb-2">
                      Thought for {(message.latency / 1000).toFixed(1)}s
                    </div>
                  )}
                  
                  {/* Assistant response */}
                  <div className="prose prose-sm lg:prose-base prose-gray dark:prose-invert max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 lg:mb-3 text-[14px] lg:text-[16px] leading-relaxed text-gray-900 dark:text-gray-100">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-4 lg:pl-6 mb-2 lg:mb-3 text-[14px] lg:text-[16px] leading-relaxed text-gray-900 dark:text-gray-100">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-4 lg:pl-6 mb-2 lg:mb-3 text-[14px] lg:text-[16px] leading-relaxed text-gray-900 dark:text-gray-100">{children}</ol>,
                        li: ({ children }) => <li className="mb-0.5 lg:mb-1">{children}</li>,
                        h1: ({ children }) => <h1 className="text-lg lg:text-2xl font-bold mb-2 lg:mb-3 mt-3 lg:mt-4 text-gray-900 dark:text-gray-100">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base lg:text-xl font-bold mb-2 lg:mb-3 mt-3 lg:mt-4 text-gray-900 dark:text-gray-100">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm lg:text-lg font-bold mb-1 lg:mb-2 mt-2 lg:mt-3 text-gray-900 dark:text-gray-100">{children}</h3>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1 lg:px-1.5 py-0.5 rounded text-[13px] lg:text-[14px] font-mono">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-2 lg:p-4 rounded-lg overflow-x-auto mb-2 lg:mb-3 text-[13px] lg:text-[14px] font-mono">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-2 lg:border-l-4 border-gray-300 dark:border-gray-600 pl-3 lg:pl-4 italic my-2 lg:my-3">{children}</blockquote>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        
        {/* Loading indicator */}
        {isProcessing && (
          <div className="w-full mb-4 lg:mb-6">
            <div className="text-[10px] lg:text-xs text-gray-500 dark:text-gray-400 mb-1 lg:mb-2">
              Thinking...
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 lg:h-5 lg:w-5 animate-spin text-gray-600 dark:text-gray-400" />
              <span className="text-xs lg:text-sm text-gray-600 dark:text-gray-400">Analyzing your query...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area with Disclaimer */}
      <div className="relative px-3 lg:px-4 pb-4 lg:pb-6 pt-3 lg:pt-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl lg:rounded-3xl shadow-lg lg:shadow-xl border border-gray-200 dark:border-gray-700 transition-all hover:shadow-xl lg:hover:shadow-2xl">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e as any)
                  }
                }}
                placeholder={isProcessing ? "Waiting for response..." : "Ask anything"}
                disabled={isProcessing || isSessionLoading}
                className="w-full px-4 lg:px-6 py-3 lg:py-4 pr-14 lg:pr-16 text-[16px] leading-relaxed bg-transparent border-0 rounded-2xl lg:rounded-3xl focus:ring-0 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                style={{ minHeight: '56px', maxHeight: '200px' }}
                rows={1}
              />
              <Button 
                type="submit" 
                disabled={isProcessing || isSessionLoading || !inputValue.trim()}
                className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 rounded-xl lg:rounded-2xl p-2 lg:p-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105"
                size="icon"
              >
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 lg:h-6 lg:w-6 animate-spin" />
                ) : (
                  <Send className="h-5 w-5 lg:h-6 lg:w-6" />
                )}
              </Button>
            </div>
          </form>
          
          {/* Disclaimer */}
          <div className="text-center mt-3 lg:mt-4 text-[10px] lg:text-xs text-gray-400 dark:text-gray-500 font-medium px-2">
            EarlyShiftAI puede cometer errores. Verificar información importante.
          </div>
        </div>
      </div>
    </div>
  )
}
