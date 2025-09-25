'use client'

import { useState, useEffect } from 'react'
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
  status?: 'queued' | 'completed' | 'failed'
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
  
  // Session management
  const { 
    sessionId, 
    isLoading: isSessionLoading, 
    error: sessionError, 
    refresh: refreshSession 
  } = useSessionId(botId, tenantId)

  // Async messaging (only initialize when we have a sessionId)
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

  // Load message history and set up Realtime when sessionId is available
  useEffect(() => {
    if (!sessionId) return

    const loadMessages = async () => {
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
        console.log('📚 Loaded', formattedMessages.length, 'messages for session:', sessionId)
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    // Set up Realtime subscription for this session
    console.log('🔌 Setting up Realtime subscription for session:', sessionId)
    
    const channel = supabase
      .channel(`session-messages-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          console.log('📨 Session Realtime update:', payload)
          
          if (payload.eventType === 'INSERT') {
            // New message added
            const newMessage: Message = {
              id: payload.new.id,
              content: payload.new.content || '',
              role: payload.new.role as 'user' | 'assistant',
              timestamp: new Date(payload.new.created_at),
              requestId: payload.new.request_id,
              latency: payload.new.latency_ms,
              status: payload.new.status,
            }
            
            console.log('🔄 Realtime INSERT:', newMessage)
            
            // Don't add duplicates - we already show messages locally
            setMessages(prev => {
              const exists = prev.find(m => m.requestId === newMessage.requestId && m.role === newMessage.role)
              return exists ? prev : [...prev, newMessage]
            })
            
          } else if (payload.eventType === 'UPDATE') {
            // Message updated (e.g., assistant response completed)
            console.log('🔄 Realtime UPDATE:', payload.new)
            
            setMessages(prev => 
              prev.map(msg => {
                // Update by requestId for assistant messages
                if (payload.new.role === 'assistant' && payload.new.request_id === msg.requestId && msg.role === 'assistant') {
                  return {
                    ...msg,
                    id: payload.new.id, // Update with real ID
                    content: payload.new.content || msg.content,
                    status: payload.new.status || msg.status,
                    latency: payload.new.latency_ms || msg.latency,
                  }
                }
                // Update by ID for exact matches
                if (msg.id === payload.new.id) {
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
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime successfully subscribed for session:', sessionId)
        }
      })

    loadMessages()

    // Cleanup subscription on unmount or sessionId change
    return () => {
      channel.unsubscribe()
    }
  }, [sessionId, supabase])

  // Handle async message completion (cleanup only - Realtime handles UI updates)
  useEffect(() => {
    if ((result || error) && requestId) {
      // Just reset the hook state - Realtime will update the UI
      reset()
    }
  }, [result, error, requestId, reset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputValue.trim() || loading || !sessionId) return

    const messageText = inputValue.trim()
    
    // 1. Add user message immediately to UI
    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: messageText,
      role: 'user',
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    
    // 2. Send to backend for processing and get requestId  
    const sendResult = await send(messageText, userId, botId, botName)
    
    // 3. Add loading placeholder with proper requestId for matching
    if (sendResult?.requestId) {
      const loadingMessage: Message = {
        id: crypto.randomUUID(),
        content: '🤖 Procesando tu consulta...',
        role: 'assistant',
        timestamp: new Date(),
        status: 'queued',
        requestId: sendResult.requestId, // This will allow Realtime updates to match
      }
      setMessages(prev => [...prev, loadingMessage])
    }
    
    setInputValue('')
  }

  const handleNewChat = async () => {
    // Clear current messages and refresh session
    setMessages([])
    await refreshSession()
  }

  // Show loading state if session is still initializing
  if (isSessionLoading || isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Inicializando conversación...</span>
      </div>
    )
  }

  // Show error state if session failed to initialize
  if (sessionError || !sessionId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Error de Sesión</h3>
          <p className="text-gray-600 mb-4">{sessionError || 'No se pudo inicializar la sesión'}</p>
          <Button onClick={refreshSession} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header with session info */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Chat con {botName}</h2>
            <p className="text-sm text-gray-600">
              Sesión: {sessionId?.slice(-8)} • Sin límites de tiempo
            </p>
          </div>
          <Button 
            onClick={handleNewChat}
            variant="outline"
            size="sm"
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Nuevo Chat
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>¡Nueva conversación iniciada! Comienza escribiendo tu primera pregunta.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : message.status === 'failed'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-gray-100'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                        li: ({ children }) => <li className="mb-1">{children}</li>,
                        h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p>{message.content}</p>
                )}
                
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                  {message.latency && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {(message.latency / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading state for current request */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 p-3 rounded-lg max-w-[80%]">
              <div className="flex items-center gap-2 text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>
                  🤖 Procesando tu consulta... 
                  <br />
                  <span className="text-xs">
                    Patrón ACK activo - sin límites de tiempo
                  </span>
                </span>
              </div>
              {requestId && (
                <div className="text-xs text-gray-500 mt-1">
                  Request: {requestId.slice(-8)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={loading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={loading || !inputValue.trim()}
            size="icon"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>⚡ Patrón ACK habilitado - respuestas sin timeouts</span>
          {sessionId && (
            <span>Sesión: {sessionId.slice(-8)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
