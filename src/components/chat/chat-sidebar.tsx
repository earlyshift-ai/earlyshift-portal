'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MoreHorizontal, X } from 'lucide-react'
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
  userEmail?: string
  tenantName?: string
  tenantLogo?: string
  currentSessionId?: string
  currentBotName?: string
  newLocalSession?: {
    id: string
    title: string
    botName?: string
  } | null
  onNewChat: () => void
  onSelectSession: (sessionId: string) => void
}

export function ChatSidebar({ 
  tenantId, 
  userId,
  userEmail,
  tenantName,
  tenantLogo,
  currentSessionId,
  currentBotName,
  newLocalSession,
  onNewChat,
  onSelectSession 
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadSessions()
    
    // Set up realtime subscription for chat sessions
    const channel = supabase
      .channel('chat-sessions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('📨 New session created:', payload.new)
          // Reload sessions to get the correct bot name and avoid duplicates
          loadSessions()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('🔄 Session updated:', payload.new)
          // Reload sessions to ensure consistency
          loadSessions()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, tenantId, currentBotName])

  // Remove this effect - let realtime subscriptions handle session updates
  // This was causing duplicate sessions

  const loadSessions = async () => {
    // Prevent concurrent loads
    if (loadingRef.current) return
    loadingRef.current = true
    
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
      loadingRef.current = false
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

  // Combine database sessions with local session
  const displaySessions = [...sessions]
  
  // Add local session if it exists and isn't already in the list
  if (newLocalSession && !sessions.some(s => s.id === newLocalSession.id)) {
    displaySessions.unshift({
      id: newLocalSession.id,
      title: newLocalSession.title || 'New Chat',
      created_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      bot_name: newLocalSession.botName
    })
  }
  
  const groupedSessions = groupSessionsByDate(displaySessions)

  // Handle search with debouncing
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Clear results if query is empty
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    
    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const response = await fetch(
          `/api/search-sessions?q=${encodeURIComponent(query)}&limit=20`
        )
        
        if (response.ok) {
          const data = await response.json()
          setSearchResults(data.results)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  // Clear search
  const clearSearch = () => {
    setIsSearching(false)
    setSearchQuery('')
    setSearchResults([])
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
  }

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-yellow-500/30 text-white">{part}</mark>
        : part
    )
  }

  return (
    <div className="flex flex-col h-full bg-[#171717] text-white overflow-hidden">
      {/* Company Logo and Name */}
      <div className="flex-shrink-0 p-4 flex items-center gap-3">
        {tenantLogo ? (
          <img 
            src={tenantLogo} 
            alt={tenantName || 'Company'} 
            className="w-8 h-8 rounded-lg object-contain bg-white p-0.5"
          />
        ) : (
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
          </div>
        )}
        {tenantName && (
          <span className="text-[14px] font-medium truncate">{tenantName}</span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex-shrink-0 space-y-1 px-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-[14px] hover:bg-gray-800 rounded-lg transition-colors text-left"
        >
          <Plus className="h-5 w-5" strokeWidth={1.5} />
          <span>New chat</span>
        </button>
        
        <button 
          onClick={() => {
            setIsSearching(true)
            setTimeout(() => searchInputRef.current?.focus(), 100)
          }}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-[14px] hover:bg-gray-800 rounded-lg transition-colors text-left"
        >
          <Search className="h-5 w-5" strokeWidth={1.5} />
          <span>Search chats</span>
        </button>
      </div>
      
      <div className="border-t border-gray-800 my-3 mx-3"></div>

      {/* Search Input */}
      {isSearching && (
        <div className="px-3 mb-3">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  clearSearch()
                }
              }}
              placeholder="Search in chats..."
              className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-lg px-3 py-2 pr-8 text-[14px] focus:outline-none focus:ring-1 focus:ring-gray-600"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chat History */}
      <div className="flex-1 overflow-y-auto px-3">
        <div className="text-[12px] text-gray-500 font-medium mb-2">
          {isSearching && searchQuery ? 'Search Results' : 'Chats'}
        </div>
        {/* Search Results */}
        {isSearching && searchQuery ? (
          searchLoading ? (
            <div className="text-gray-400 text-sm text-center py-4">
              Searching...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              No results found for "{searchQuery}"
            </div>
          ) : (
            <div className="space-y-1">
              {searchResults.map((result: any) => (
                <div
                  key={`${result.id}-${result.matchType}`}
                  onClick={() => {
                    onSelectSession(result.id)
                    clearSearch()
                  }}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 group hover:bg-gray-800 transition-all duration-150 cursor-pointer",
                    currentSessionId === result.id ? "bg-gray-800" : ""
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] truncate">
                          {result.matchType === 'title' 
                            ? highlightMatch(result.title, searchQuery)
                            : result.title}
                        </div>
                        {result.botName && (
                          <div className="text-[11px] text-gray-500 truncate">
                            {result.botName}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded",
                        result.matchType === 'title' 
                          ? "bg-blue-500/20 text-blue-400" 
                          : "bg-green-500/20 text-green-400"
                      )}>
                        {result.matchType}
                      </span>
                    </div>
                    {result.matchType === 'message' && (
                      <div className="text-[12px] text-gray-400 truncate">
                        "{highlightMatch(result.matchedContent, searchQuery)}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* Normal Chat List */
          loading ? (
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
              {dateSessions.map(session => (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={cn(
                    "w-full text-left rounded-lg px-3 py-2.5 mb-0.5 group hover:bg-gray-800 transition-all duration-150 cursor-pointer text-[14px]",
                    currentSessionId === session.id ? "bg-gray-800" : ""
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">
                        {session.title}
                      </div>
                      {session.bot_name && (
                        <div className="text-[11px] text-gray-500 truncate mt-0.5">
                          {session.bot_name}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={(e) => deleteSession(session.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-opacity ml-2 flex-shrink-0"
                    >
                      <MoreHorizontal className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))
        ))}
      </div>

      {/* User Profile */}
      <div className="flex-shrink-0 border-t border-gray-800 p-3">
        <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 rounded-lg transition-colors">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
            {userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="text-[14px] truncate flex-1 text-left">{userEmail || 'User'}</span>
        </button>
      </div>
    </div>
  )
}