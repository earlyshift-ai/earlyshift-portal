'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Search, MoreHorizontal, X, LogOut, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ContextMenu, DeleteConfirmationModal, RenameModal } from '@/components/ui/context-menu'
import { Toast } from '@/components/ui/toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useRouter } from 'next/navigation'

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
  userName?: string
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
  userName,
  tenantName,
  tenantLogo,
  currentSessionId,
  currentBotName,
  newLocalSession,
  onNewChat,
  onSelectSession 
}: ChatSidebarProps) {
  const router = useRouter()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean
    sessionId: string
    sessionTitle: string
    position: { x: number; y: number }
  }>({
    isOpen: false,
    sessionId: '',
    sessionTitle: '',
    position: { x: 0, y: 0 }
  })
  
  // Modal states
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean
    sessionId: string
    sessionTitle: string
  }>({
    isOpen: false,
    sessionId: '',
    sessionTitle: ''
  })
  
  const [renameModal, setRenameModal] = useState<{
    isOpen: boolean
    sessionId: string
    currentTitle: string
  }>({
    isOpen: false,
    sessionId: '',
    currentTitle: ''
  })
  
  // Toast state
  const [toast, setToast] = useState<{
    isOpen: boolean
    message: string
    type: 'success' | 'error' | 'info' | 'warning'
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  })
  
  const supabase = createClient()

  // Set mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

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
          // Only reload if the new session is not our local session
          if (!newLocalSession || payload.new.id !== newLocalSession.id) {
            loadSessions()
          }
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
          // Update the specific session in state instead of reloading all
          setSessions(prev => prev.map(session => 
            session.id === payload.new.id 
              ? { ...session, title: payload.new.title || session.title, last_message_at: payload.new.last_message_at || session.last_message_at }
              : session
          ))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, tenantId])

  // Update sessions when newLocalSession changes
  useEffect(() => {
    if (newLocalSession) {
      // Check if this session already exists in our sessions list
      const existingSession = sessions.find(s => s.id === newLocalSession.id)
      if (!existingSession) {
        // Add the new local session to the sessions list immediately
        const localSession: ChatSession = {
          id: newLocalSession.id,
          title: newLocalSession.title || 'New Chat',
          created_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(),
          bot_name: newLocalSession.botName
        }
        setSessions(prev => [localSession, ...prev])
      }
    }
  }, [newLocalSession])

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

  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/session?sessionId=${sessionId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete session')
      }
      
      if (currentSessionId === sessionId) {
        onNewChat()
      }
      
      loadSessions()
      setToast({
        isOpen: true,
        message: 'Chat deleted successfully',
        type: 'success'
      })
    } catch (error) {
      console.error('Error deleting session:', error)
      setToast({
        isOpen: true,
        message: 'Failed to delete chat',
        type: 'error'
      })
    }
  }

  const renameSession = async (sessionId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/session?sessionId=${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: newTitle }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rename session')
      }
      
      loadSessions()
      setToast({
        isOpen: true,
        message: 'Chat renamed successfully',
        type: 'success'
      })
    } catch (error) {
      console.error('Error renaming session:', error)
      setToast({
        isOpen: true,
        message: 'Failed to rename chat',
        type: 'error'
      })
    }
  }

  const copySessionId = async (sessionId: string) => {
    try {
      await navigator.clipboard.writeText(sessionId)
      setToast({
        isOpen: true,
        message: 'Conversation ID copied to clipboard',
        type: 'success'
      })
    } catch (error) {
      console.error('Failed to copy session ID:', error)
      setToast({
        isOpen: true,
        message: 'Failed to copy conversation ID',
        type: 'error'
      })
    }
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string, sessionTitle: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    const button = e.currentTarget as HTMLElement
    const rect = button.getBoundingClientRect()
    
    // Calculate position to keep menu on screen
    const menuWidth = 250 // Approximate menu width
    const menuHeight = 300 // Approximate menu height
    
    let x = rect.right + 5 // Position to the right of the button
    let y = rect.top
    
    // Adjust if menu would go off right edge
    if (x + menuWidth > window.innerWidth) {
      x = rect.left - menuWidth - 5 // Position to the left instead
    }
    
    // Adjust if menu would go off bottom edge  
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }
    
    setContextMenu({
      isOpen: true,
      sessionId,
      sessionTitle,
      position: { x, y }
    })
  }

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }

  const handleRename = () => {
    setRenameModal({
      isOpen: true,
      sessionId: contextMenu.sessionId,
      currentTitle: contextMenu.sessionTitle
    })
  }

  const handleDelete = () => {
    setDeleteModal({
      isOpen: true,
      sessionId: contextMenu.sessionId,
      sessionTitle: contextMenu.sessionTitle
    })
  }

  const handleCopyId = () => {
    copySessionId(contextMenu.sessionId)
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

  // Use sessions directly - they now include the local session
  const groupedSessions = groupSessionsByDate(sessions)

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
                      onClick={(e) => handleContextMenu(e, session.id, session.title)}
                      className="md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100 opacity-50 hover:opacity-100 p-1 hover:bg-gray-700 rounded transition-all ml-2 flex-shrink-0"
                      aria-label="More options"
                    >
                      <MoreHorizontal className="h-4 w-4 text-gray-400 hover:text-gray-200" />
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
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 rounded-lg transition-colors group">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                  {userName ? userName.charAt(0).toUpperCase() : userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="text-[14px] truncate flex-1 text-left">{userName || userEmail || 'User'}</span>
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="start" 
              side="top" 
              className="w-[280px] bg-[#212121] border-gray-700 text-white mb-2"
            >
              <DropdownMenuItem 
                onClick={async () => {
                  const supabase = createClient()
                  await supabase.auth.signOut()
                  router.push('/auth/login')
                }}
                className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer text-red-400 focus:text-red-400"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-800 rounded-lg transition-colors group">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
              {userName ? userName.charAt(0).toUpperCase() : userEmail ? userEmail.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="text-[14px] truncate flex-1 text-left">{userName || userEmail || 'User'}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        onClose={closeContextMenu}
        onRename={handleRename}
        onDelete={handleDelete}
        onCopyId={handleCopyId}
        position={contextMenu.position}
        sessionTitle={contextMenu.sessionTitle}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => deleteSession(deleteModal.sessionId)}
        sessionTitle={deleteModal.sessionTitle}
      />

      {/* Rename Modal */}
      <RenameModal
        isOpen={renameModal.isOpen}
        onClose={() => setRenameModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={(newTitle) => renameSession(renameModal.sessionId, newTitle)}
        currentTitle={renameModal.currentTitle}
      />

      {/* Toast Notifications */}
      {toast.isOpen && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  )
}