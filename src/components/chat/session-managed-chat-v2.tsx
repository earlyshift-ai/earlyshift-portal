'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, RefreshCw, Clock } from 'lucide-react'
import { useSessionId } from '@/hooks/use-session-id'
import { useAsyncMessage } from '@/hooks/use-async-message'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  requestId?: string
  latency?: number
  status?: 'queued' | 'completed' | 'failed' | 'delivered' | 'pending'
}

interface SessionManagedChatProps {
  botName: string
  botId?: string
  userId?: string
  tenantId?: string
}

export function SessionManagedChat({ 
  botName, 
  botId,
  userId = 'current-user',
  tenantId
}: SessionManagedChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentRequestId, setCurrentRequestId] = useState<string | null>(null)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)
  const loadedRef = useRef(false)
  
  // Session management
  const { 
    sessionId, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    refresh: refreshSession 
  } = useSessionId(botId, tenantId)

  // Async messaging
  const { 
    send, 
    loading, 
    requestId, 
    result, 
    error, 
    latency, 
    reset 
  } = useAsyncMessage(sessionId || '')

  const supabase = createClient()

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load messages and setup Realtime subscription
  useEffect(() => {
    if (!sessionId || loadedRef.current) return

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

        const formattedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          content: msg.content || '',
          role: msg.role as 'user' | 'assistant',
          timestamp: new Date(msg.created_at),
          requestId: msg.request_id,
          latency: msg.latency_ms,
          status: msg.status,
        }))

        setMessages(formattedMessages)
        loadedRef.current = true
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
        .channel(`session-${sessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            console.log('📨 Realtime event:', payload)
            
            if (payload.eventType === 'INSERT') {
              const newMessage: Message = {
                id: payload.new.id,
                content: payload.new.content || '',
                role: payload.new.role as 'user' | 'assistant',
                timestamp: new Date(payload.new.created_at),
                requestId: payload.new.request_id,
                latency: payload.new.latency_ms,
                status: payload.new.status,
              }
              
              console.log('🆕 New message details:', {
                id: newMessage.id,
                role: newMessage.role,
                status: newMessage.status,
                requestId: newMessage.requestId,
                content: newMessage.content.substring(0, 50) + '...'
              })
              
              // Check if this message already exists (prevent duplicates)
              setMessages(prev => {
                const exists = prev.some(m => m.id === newMessage.id)
                if (exists) {
                  console.log('⚠️ Duplicate message prevented:', newMessage.id)
                  return prev
                }
                console.log('➕ Adding new message:', newMessage.role, newMessage.id)
                return [...prev, newMessage]
              })
              
            } else if (payload.eventType === 'UPDATE') {
              console.log('🔄 UPDATE event details:', {
                id: payload.new.id,
                role: payload.new.role,
                status: payload.new.status,
                requestId: payload.new.request_id,
                currentRequestId: currentRequestId,
                content: payload.new.content?.substring(0, 50) + '...'
              })
              
              setMessages(prev => 
                prev.map(msg => {
                  if (msg.id === payload.new.id) {
                    console.log('📝 Updating message by ID:', msg.id)
                    return {
                      ...msg,
                      content: payload.new.content || msg.content,
                      status: payload.new.status || msg.status,
                      latency: payload.new.latency_ms || msg.latency,
                    }
                  }
                  return msg
                })
              )
              
              // If this update completes our current request, reset processing state
              if (payload.new.request_id === currentRequestId && 
                  (payload.new.status === 'completed' || payload.new.status === 'failed')) {
                console.log('✅ Request completed:', currentRequestId)
                setIsProcessing(false)
                setCurrentRequestId(null)
              }
            }
          }
        )
        .subscribe((status) => {
          console.log('📡 Realtime subscription status:', status)
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime connected for session:', sessionId)
          }
        })
    }

    setupChat()

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        console.log('🔌 Cleaning up Realtime subscription')
        channelRef.current.unsubscribe()
        channelRef.current = null
      }
    }
  }, [sessionId, supabase, currentRequestId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputValue.trim() || isProcessing || !sessionId) return

    const messageText = inputValue.trim()
    setInputValue('')
    setIsProcessing(true)
    
    try {
      // Send message and get requestId
      const sendResult = await send(messageText, userId, botId, botName)
      
      if (sendResult?.requestId) {
        setCurrentRequestId(sendResult.requestId)
        console.log('📤 Message sent with requestId:', sendResult.requestId)
      }
    } catch (error) {
      console.error('❌ Failed to send message:', error)
      setIsProcessing(false)
      setCurrentRequestId(null)
    }
  }

  const handleNewChat = async () => {
    console.log('🆕 Starting new chat')
    
    // Clear local state
    setMessages([])
    setIsProcessing(false)
    setCurrentRequestId(null)
    loadedRef.current = false
    
    // Refresh session
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
    <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-lg shadow-md">
      {/* Header */}
      <div className="p-4 border-b dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{botName}</h2>
          {isProcessing && (
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Procesando...
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[70%] p-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
              }`}
            >
              {message.role === 'assistant' && message.status === 'queued' ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Procesando tu consulta...</span>
                </div>
              ) : (
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              )}
              
              {message.latency && message.role === 'assistant' && (
                <div className="mt-2 text-xs opacity-60 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {(message.latency / 1000).toFixed(1)}s
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700">
        <div className="flex gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={isProcessing ? "Esperando respuesta..." : "Escribe tu mensaje..."}
            disabled={isProcessing || isSessionLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={isProcessing || isSessionLoading || !inputValue.trim()}
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        {isProcessing && (
          <p className="text-xs text-gray-500 mt-2">
            El asistente está procesando tu consulta. Por favor espera...
          </p>
        )}
      </form>
    </div>
  )
}
