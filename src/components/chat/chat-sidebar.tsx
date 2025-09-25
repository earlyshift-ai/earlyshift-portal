'use client'

import { useState, useEffect } from 'react'
import { Plus, MessageSquare, Clock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface ChatSession {
  id: string
  title: string
  created_at: string
  last_message_at: string
  bot_name?: string
}

interface ChatSidebarProps {
  tenantId: string
  userId: string
  currentSessionId?: string
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
}

export function ChatSidebar({ 
  tenantId, 
  userId, 
  currentSessionId,
  onNewChat,
  onSelectSession 
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadSessions()
    
    // Set up realtime subscription
    const channel = supabase
      .channel('chat-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${userId}`
        },
        () => {
          loadSessions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, tenantId])

  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          title,
          created_at,
          last_message_at,
          bots (name)
        `)
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false })
        .limit(50)

      if (error) throw error

      const formattedSessions: ChatSession[] = data.map((session: any) => ({
        id: session.id,
        title: session.title || 'New Chat',
        created_at: session.created_at,
        last_message_at: session.last_message_at,
        bot_name: session.bots?.name
      }))

      setSessions(formattedSessions)
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ status: 'deleted' })
        .eq('id', sessionId)

      if (error) throw error
      
      if (currentSessionId === sessionId) {
        onNewChat()
      }
      
      loadSessions()
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  const groupSessionsByDate = (sessions: ChatSession[]) => {
    const groups: Record<string, ChatSession[]> = {}
    
    sessions.forEach(session => {
      const dateKey = formatDate(session.last_message_at)
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(session)
    })
    
    return groups
  }

  const groupedSessions = groupSessionsByDate(sessions)

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* New Chat Button */}
      <div className="p-3 border-b border-gray-800">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2 bg-gray-800 hover:bg-gray-700 text-white"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="text-gray-400 text-sm text-center py-4">
            Loading chats...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-gray-400 text-sm text-center py-4">
            No chats yet. Start a new conversation!
          </div>
        ) : (
          Object.entries(groupedSessions).map(([date, dateSessions]) => (
            <div key={date} className="mb-4">
              <div className="text-xs text-gray-500 font-medium mb-2 px-2">
                {date}
              </div>
              {dateSessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2 mb-1 group hover:bg-gray-800 transition-colors",
                    currentSessionId === session.id && "bg-gray-800"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {session.title}
                        </div>
                        {session.bot_name && (
                          <div className="text-xs text-gray-500 truncate">
                            with {session.bot_name}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-gray-400" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          ))
        )}
      </div>

      {/* User Stats */}
      <div className="border-t border-gray-800 p-3">
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="h-3 w-3" />
            {sessions.length} conversations
          </div>
        </div>
      </div>
    </div>
  )
}