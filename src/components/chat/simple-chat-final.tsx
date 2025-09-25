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
}

export function SimpleChat({ 
  botName, 
  botId,
  userId = 'current-user',
  tenantId,
  sessionId: externalSessionId,
  className = ''
}: SimpleChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  
  // Session management - use external sessionId if provided
  const { 
    sessionId: generatedSessionId, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    refresh: refreshSession 
  } = useSessionId(botId, tenantId)
  
  const sessionId = externalSessionId || generatedSessionId

  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load messages and setup Realtime subscription
  useEffect(() => {
    if (!sessionId) return

    const setupChat = async () => {
      console.log('🔧 Setting up chat for session:', sessionId)
      
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
            
            // Only add non-system messages
            if (newMessage.role !== 'system') {
              setMessages(prev => {
                // Check if message already exists
                const exists = prev.some(m => m.id === newMessage.id)
                if (!exists) {
                  console.log('➕ Adding message:', newMessage.role, newMessage.id)
                  return [...prev, newMessage]
                }
                return prev
              })
            }
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
    setMessages([])
    setIsProcessing(false)
    await refreshSession()
  }

  if (isSessionLoading || isLoadingHistory) {
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
    <div className={`flex flex-col h-full bg-white dark:bg-gray-950 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{botName}</h2>
          {isProcessing && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analizando...
            </span>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleNewChat}
          disabled={isProcessing}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Nuevo Chat
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <div className="max-w-3xl mx-auto">
          {messages.map((message, index) => (
            <div key={message.id} className="mb-6">
              {message.role === 'user' ? (
                // User message - aligned to right
                <div className="flex justify-end">
                  <div className="max-w-[85%] text-right">
                    <div className="inline-block text-left bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-3">
                      <p className="text-gray-900 dark:text-gray-100">
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
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Thought for {(message.latency / 1000).toFixed(1)}s
                    </div>
                  )}
                  
                  {/* Assistant response */}
                  <div className="prose prose-gray dark:prose-invert max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-3 text-gray-900 dark:text-gray-100">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-6 mb-3 text-gray-900 dark:text-gray-100">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 text-gray-900 dark:text-gray-100">{children}</ol>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-3 mt-4 text-gray-900 dark:text-gray-100">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-3 mt-4 text-gray-900 dark:text-gray-100">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mb-2 mt-3 text-gray-900 dark:text-gray-100">{children}</h3>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        code: ({ children }) => <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">{children}</code>,
                        pre: ({ children }) => <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-3">{children}</pre>,
                        blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-3">{children}</blockquote>,
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
          <div className="w-full mb-6">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Thinking...
            </div>
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-gray-600 dark:text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400">Analyzing your query...</span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area with Disclaimer */}
      <div className="relative px-4 pb-8 pt-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-200 dark:border-gray-700 transition-all hover:shadow-2xl">
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
                className="w-full px-8 py-6 pr-16 text-lg bg-transparent border-0 rounded-3xl focus:ring-0 focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
                style={{ minHeight: '72px', maxHeight: '200px' }}
                rows={1}
              />
              <Button 
                type="submit" 
                disabled={isProcessing || isSessionLoading || !inputValue.trim()}
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-2xl p-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:scale-105"
                size="icon"
              >
                {isProcessing ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Send className="h-6 w-6" />
                )}
              </Button>
            </div>
          </form>
          
          {/* Disclaimer */}
          <div className="text-center mt-4 text-xs text-gray-400 dark:text-gray-500 font-medium">
            EarlyShiftAI puede cometer errores. Verificar información importante.
          </div>
        </div>
      </div>
    </div>
  )
}
