'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Clock } from 'lucide-react'
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

interface AsyncChatInterfaceProps {
  sessionId: string
  botName: string
  botId?: string
  userId?: string
}

export function AsyncChatInterface({ 
  sessionId, 
  botName, 
  botId,
  userId = 'current-user' 
}: AsyncChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  
  const { 
    send, 
    loading, 
    requestId, 
    result, 
    error, 
    latency, 
    reset 
  } = useAsyncMessage(sessionId)

  const supabase = createClient()

  // Load message history
  useEffect(() => {
    const loadMessages = async () => {
      try {
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
      } catch (error) {
        console.error('Failed to load messages:', error)
      } finally {
        setIsLoadingHistory(false)
      }
    }

    loadMessages()
  }, [sessionId, supabase])

  // Handle async message result
  useEffect(() => {
    if (result && requestId) {
      // Add AI response to messages
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        content: result,
        role: 'assistant',
        timestamp: new Date(),
        requestId,
        latency,
        status: 'completed',
      }
      
      setMessages(prev => [...prev, aiMessage])
      reset()
    }
  }, [result, requestId, latency, reset])

  // Handle async message error
  useEffect(() => {
    if (error && requestId) {
      // Add error message to chat
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: `Lo siento, hubo un error procesando tu consulta: ${error}`,
        role: 'assistant',
        timestamp: new Date(),
        requestId,
        status: 'failed',
      }
      
      setMessages(prev => [...prev, errorMessage])
      reset()
    }
  }, [error, requestId, reset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputValue.trim() || loading) return

    const userMessage: Message = {
      id: crypto.randomUUID(),
      content: inputValue.trim(),
      role: 'user',
      timestamp: new Date(),
    }

    // Add user message immediately
    setMessages(prev => [...prev, userMessage])
    
    // Send for async processing with bot context
    await send(inputValue.trim(), userId, botId, botName)
    
    setInputValue('')
  }

  if (isLoadingHistory) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Cargando conversación...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Chat con {botName}</h2>
        <p className="text-sm text-gray-600">
          Nuevas consultas complejas se procesan en segundo plano
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No hay mensajes aún. ¡Comienza la conversación!</p>
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
                  🤖 Analizando tu consulta compleja... 
                  <br />
                  <span className="text-xs">
                    Esto puede tomar varios minutos para consultas complejas
                  </span>
                </span>
              </div>
              {requestId && (
                <div className="text-xs text-gray-500 mt-1">
                  ID: {requestId.slice(-8)}
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
        
        {loading && (
          <p className="text-xs text-gray-500 mt-2">
            ⚡ Procesamiento asíncrono activo - no hay límites de tiempo
          </p>
        )}
      </div>
    </div>
  )
}
