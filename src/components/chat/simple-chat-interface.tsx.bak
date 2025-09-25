'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/components/tenant-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Loader2, Bot } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

interface Bot {
  id: string
  name: string
  description: string
  custom_name?: string
  model_config: Record<string, unknown>
}

export function SimpleChatInterface() {
  const { tenant } = useTenant()
  const [selectedBot, setSelectedBot] = useState<Bot | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [availableBots, setAvailableBots] = useState<Bot[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // Load available bots for the tenant
  useEffect(() => {
    if (!tenant) return
    loadAvailableBots()
  }, [tenant])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadAvailableBots = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_access')
        .select(`
          bot_id,
          custom_name,
          enabled,
          bots (
            id,
            name,
            description,
            model_config,
            status
          )
        `)
        .eq('tenant_id', (tenant as any)!.id)
        .eq('enabled', true)
        .eq('bots.status', 'active')

      if (error) throw error

      const bots = data
        .filter(item => item.bots)
        .map(item => ({
          id: item.bots!.id,
          name: item.bots!.name,
          description: item.bots!.description,
          custom_name: item.custom_name,
          model_config: item.bots!.model_config
        }))

      setAvailableBots(bots)
      
      // Auto-select first bot if none selected
      if (bots.length > 0 && !selectedBot) {
        setSelectedBot(bots[0])
      }
    } catch (error) {
      console.error('Error loading bots:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedBot || !input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      createdAt: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Simple mock response for now - replace with actual API call
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          botId: selectedBot.id,
          tenantId: (tenant as any).id,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content || 'Sorry, I encountered an error processing your request.',
        createdAt: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Chat error:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again later.',
        createdAt: new Date()
      }

      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading tenant information...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full max-h-[80vh] bg-white dark:bg-gray-900 rounded-lg border">
      {/* Header */}
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" style={{ color: (tenant as any).primary_color }} />
            {selectedBot ? (
              <span>{selectedBot.custom_name || selectedBot.name}</span>
            ) : (
              <span>Select a Bot</span>
            )}
          </CardTitle>
          {availableBots.length > 1 && (
            <select 
              value={selectedBot?.id || ''} 
              onChange={(e) => {
                const bot = availableBots.find(b => b.id === e.target.value)
                setSelectedBot(bot || null)
                setMessages([]) // Clear messages when switching bots
              }}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="">Select Bot</option>
              {availableBots.map(bot => (
                <option key={bot.id} value={bot.id}>
                  {bot.custom_name || bot.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {selectedBot && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedBot.description}
          </p>
        )}
      </CardHeader>

      {/* Messages */}
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {selectedBot ? (
              <>
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === 'user' 
                        ? 'text-white' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                    }`} style={message.role === 'user' ? { backgroundColor: (tenant as any).primary_color } : {}}>
                      {message.role === 'user' ? (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
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
                      )}
                      <p className="text-xs opacity-70 mt-1">
                        {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Analizando tu consulta compleja con la base de datos... Esto puede tomar 1-2 minutos. Para consultas muy complejas, considera dividir la pregunta en partes más específicas.</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Bot className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Welcome to {(tenant as any).name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {availableBots.length > 0 
                      ? "Select a bot to start chatting" 
                      : "No bots available. Contact your administrator."
                    }
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          {selectedBot && (
            <div className="border-t p-4">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Message ${selectedBot.custom_name || selectedBot.name}...`}
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !input.trim()}
                  style={{ backgroundColor: (tenant as any).primary_color }}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  )
}
