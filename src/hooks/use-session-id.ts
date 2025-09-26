import { useState, useEffect, useCallback, useRef } from 'react'

interface UseSessionIdReturn {
  sessionId: string | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  clearSession: () => void
}

/**
 * Session ID Manager Hook
 * Handles creation, persistence, and lifecycle of chat sessions
 */
export function useSessionId(botId?: string, tenantId?: string): UseSessionIdReturn {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Prevent concurrent session creation for the same bot
  const creationInProgressRef = useRef<Promise<string> | null>(null)

  // If botId is not provided, return early with null values
  // This happens when we have an external session
  const skipHook = !botId
  
  const sessionKey = botId ? `sessionId:${botId}` : 'sessionId:default'

  const createNewSession = useCallback(async (): Promise<string> => {
    // Check if session creation is already in progress for this bot
    if (creationInProgressRef.current) {
      console.log('🔄 Session creation already in progress, waiting for existing request...')
      return await creationInProgressRef.current
    }
    
    console.log('🆕 Creating new session for bot:', botId)
    
    const sessionCreation = (async () => {
      const response = await fetch('/api/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          botId,
          tenantId,
          // Note: userId will be extracted from auth in the API
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()
      const newSessionId = data.sessionId

      if (!newSessionId) {
        throw new Error('No sessionId returned from API')
      }

      // Store in localStorage
      localStorage.setItem(sessionKey, newSessionId)
      console.log('💾 Session stored:', newSessionId)

      return newSessionId
    })()
    
    // Store the promise to prevent concurrent requests
    creationInProgressRef.current = sessionCreation
    
    try {
      const result = await sessionCreation
      return result
    } finally {
      // Clear the promise when done
      creationInProgressRef.current = null
    }
  }, [botId, tenantId, sessionKey])

  const loadOrCreateSession = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Try to load from localStorage first
      const storedSessionId = localStorage.getItem(sessionKey)
      
      if (storedSessionId) {
        console.log('📂 Found stored session:', storedSessionId)
        
        // Verify session still exists in database
        try {
          const response = await fetch(`/api/session?sessionId=${encodeURIComponent(storedSessionId)}`)
          
          if (response.ok) {
            console.log('✅ Session verified:', storedSessionId)
            setSessionId(storedSessionId)
            return
          } else if (response.status === 404) {
            console.log('❌ Stored session not found in database, clearing localStorage')
            localStorage.removeItem(sessionKey)
          } else {
            console.log('❌ Session verification failed with status:', response.status)
            // Don't remove from localStorage for non-404 errors, might be temporary server issue
          }
        } catch (verifyError) {
          console.log('❌ Session verification network error, keeping localStorage for retry')
          // Don't remove from localStorage for network errors
        }
      }

      // Only create new session if we don't have a stored one or it was confirmed deleted
      if (!storedSessionId || !localStorage.getItem(sessionKey)) {
        console.log('🆕 Creating new session because no valid stored session found')
        const newSessionId = await createNewSession()
        setSessionId(newSessionId)
      } else {
        // If we have a stored session but verification failed (non-404), use it anyway
        console.log('📝 Using stored session despite verification failure (might be temporary server issue)')
        setSessionId(storedSessionId)
      }

    } catch (err: any) {
      console.error('Session load/create error:', err)
      setError(err.message || 'Failed to initialize session')
    } finally {
      setIsLoading(false)
    }
  }, [sessionKey, createNewSession])

  const refresh = useCallback(async () => {
    console.log('🔄 Refreshing session (creating new)')
    
    try {
      setError(null)
      
      // Clear old session
      localStorage.removeItem(sessionKey)
      
      // Create new session
      const newSessionId = await createNewSession()
      setSessionId(newSessionId)
      
      console.log('✅ Session refreshed:', newSessionId)
    } catch (err: any) {
      console.error('Session refresh error:', err)
      setError(err.message || 'Failed to refresh session')
    }
  }, [sessionKey, createNewSession])

  const clearSession = useCallback(() => {
    console.log('🗑️ Clearing session')
    localStorage.removeItem(sessionKey)
    setSessionId(null)
  }, [sessionKey])

  // Initialize session on mount
  useEffect(() => {
    if (skipHook) {
      console.log('🚫 Skipping useSessionId hook - external session provided')
      setIsLoading(false)
      return
    }
    
    if (!botId) {
      console.log('🚫 Skipping useSessionId hook - no botId provided')
      setIsLoading(false)
      return
    }
    
    console.log('🔧 Initializing session for bot:', botId)
    loadOrCreateSession()
  }, [loadOrCreateSession, skipHook, botId])

  // Return early if hook is skipped
  if (skipHook) {
    return {
      sessionId: null,
      isLoading: false,
      error: null,
      refresh: async () => {},
      clearSession: () => {},
    }
  }

  return {
    sessionId,
    isLoading,
    error,
    refresh,
    clearSession,
  }
}
