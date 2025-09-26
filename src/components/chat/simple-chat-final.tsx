'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, RefreshCw, Clock } from 'lucide-react'
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
}

interface SimpleChatProps {
  botName: string
  botId?: string
  userId?: string
  tenantId?: string
  sessionId?: string
  className?: string
  onNewChat?: () => void
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  
  // Session management - prevent hook from running when we have an external session
  const shouldUseHook = !externalSessionId && botId
  console.log('🔧 SimpleChat session logic:', { externalSessionId, botId, shouldUseHook })
  
  const { 
    sessionId: generatedSessionId, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    refresh: refreshSession,
    clearSession 
  } = useSessionId(shouldUseHook ? botId : undefined, shouldUseHook ? tenantId : undefined)
  
  const sessionId = externalSessionId || generatedSessionId

  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load messages and setup Realtime subscription
  useEffect(() => {
    if (!sessionId) {
      // Clear messages when no session
      setMessages([])
      return
    }

    const setupChat = async () => {
      console.log('🔧 Setting up chat for session:', sessionId)
      
      // Clear previous messages and reset state
      setMessages([])
      setHasUserMessage(false)
      
      // Load existing messages
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
          }))

        setMessages(formattedMessages)
        // Check if there are user messages
        setHasUserMessage(formattedMessages.some(m => m.role === 'user'))
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setIsLoadingHistory(false)
      }

      // Clean up previous subscription if exists
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }

      // Set up Realtime subscription
      console.log('🔌 Setting up Realtime for session:', sessionId)
      
      channelRef.current = supabase
        .channel(`simple-chat-${sessionId}`)
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
            }
            
            // Add the new message
            setMessages(prev => {
                // Check if message already exists or if it's a user message we already have
                const exists = prev.some(m => 
                  m.id === newMessage.id || 
                  (m.role === 'user' && m.content === newMessage.content && m.id.startsWith('temp-'))
                )
                
                if (!exists) {
                  console.log('➕ Adding message:', newMessage.role, newMessage.id)
                  return [...prev, newMessage]
                } else if (exists && prev.some(m => m.id.startsWith('temp-') && m.content === newMessage.content)) {
                  // Replace temporary message with real one from database
                  console.log('🔄 Replacing temp message with real one')
                  return prev.map(m => 
                    m.id.startsWith('temp-') && m.content === newMessage.content 
                      ? newMessage 
                      : m
                  )
                }
                return prev
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
            
            // If it's an assistant message being completed, we're done processing
            if (payload.new.role === 'assistant' && payload.new.status === 'completed') {
              console.log('✅ Assistant response completed')
              setIsProcessing(false)
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
    }
  }, [sessionId, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputValue.trim() || isProcessing || !sessionId) return

    const messageText = inputValue.trim()
    setInputValue('')
    setIsProcessing(true)
    
    // If this is the first user message, notify parent to update sidebar
    if (!hasUserMessage && onFirstMessage) {
      console.log('📝 First message in session, notifying parent')
      onFirstMessage(sessionId, messageText)
      setHasUserMessage(true)
    }
    
    // Add user message immediately (optimistic update)
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageText,
      role: 'user',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    
    try {
      // Send to backend first - it will handle inserting the user message
      const response = await fetch('/api/chat-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
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
      
    } catch (error) {
      console.error('❌ Failed to send message:', error)
      setIsProcessing(false)
    }
  }

  const handleNewChat = async () => {
    console.log('🆕 Starting new chat')
    setHasUserMessage(false) // Reset for new chat
    if (onNewChat) {
      // Use parent's new chat handler if provided
      onNewChat()
    } else {
      // Fallback to local refresh
      setMessages([])
      setIsProcessing(false)
      await refreshSession()
    }
  }

  // Only show loading if we're actually loading a session
  // Skip if we have an external session
  if (!externalSessionId && (isSessionLoading || isLoadingHistory)) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        {isSessionLoading ? 'Iniciando sesión...' : 'Cargando historial...'}
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
    <div className={`flex flex-col h-full w-full bg-white dark:bg-gray-950 ${className}`}>
      {/* Header */}
      <div className="px-3 lg:px-4 py-2 lg:py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base lg:text-lg font-semibold">{botName}</h2>
          {isProcessing && (
            <span className="text-xs lg:text-sm text-gray-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="hidden sm:inline">Analizando...</span>
            </span>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleNewChat}
          disabled={isProcessing}
          className="h-8 lg:h-9 px-2 lg:px-3 text-xs lg:text-sm"
        >
          <RefreshCw className="h-3 w-3 lg:h-4 lg:w-4 mr-1 lg:mr-2" />
          <span className="hidden sm:inline">Nuevo Chat</span>
          <span className="sm:hidden">Nuevo</span>
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 lg:px-4 pb-2">
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
      <div className="relative px-3 lg:px-4 pb-6 lg:pb-8 pt-3 lg:pt-4">
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
