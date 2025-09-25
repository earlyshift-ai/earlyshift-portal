import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AsyncMessageState {
  loading: boolean
  requestId: string | null
  result: string | null
  error: string | null
  latency: number | null
}

interface AsyncMessageHook extends AsyncMessageState {
  send: (text: string, userId?: string, botId?: string, botName?: string) => Promise<{ requestId: string } | null>
  reset: () => void
}

/**
 * Hook for async messaging with Supabase Realtime + polling fallback
 * Implements ACK pattern to avoid timeouts
 * Now properly scoped to session_id for FK integrity
 */
export function useAsyncMessage(sessionId: string): AsyncMessageHook {
  const [state, setState] = useState<AsyncMessageState>({
    loading: false,
    requestId: null,
    result: null,
    error: null,
    latency: null,
  })
  
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const channelRef = useRef<any>(null)
  const supabase = createClient()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe()
      }
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      loading: false,
      requestId: null,
      result: null,
      error: null,
      latency: null,
    })
    
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    
    if (channelRef.current) {
      channelRef.current.unsubscribe()
      channelRef.current = null
    }
  }, [])

  const send = useCallback(async (text: string, userId = 'current-user', botId?: string, botName?: string): Promise<{ requestId: string } | null> => {
    // Reset previous state
    reset()
    
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // 1. Send to async chat API for ACK
      const response = await fetch('/api/chat-simple', { // Using simple endpoint with service role
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId: sessionId, // Use sessionId as conversationId for n8n compatibility
          sessionId,
          messageId: crypto.randomUUID(),
          userId,
          text,
          botId,
          botName,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      // 2. Get ACK with requestId
      const ackData = await response.json()
      const { requestId } = ackData

      if (!requestId) {
        throw new Error('No requestId received from server')
      }

      setState(prev => ({ ...prev, requestId }))

      // 3. Set up Supabase Realtime subscription
      const startTime = Date.now()
      
      try {
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
              console.log('Realtime update received:', payload)
              
              const messageData = payload.new as any
              const { status, content, error_text, latency_ms, role, request_id } = messageData
              
              // Only process assistant messages that match our request
              if (role === 'assistant' && request_id === requestId) {
                if (status === 'completed') {
                  setState(prev => ({
                    ...prev,
                    loading: false,
                    result: content || '',
                    latency: latency_ms || Date.now() - startTime,
                  }))
                  
                  // Cleanup
                  if (timerRef.current) clearInterval(timerRef.current)
                  if (channelRef.current) channelRef.current.unsubscribe()
                  
                } else if (status === 'failed') {
                  setState(prev => ({
                    ...prev,
                    loading: false,
                    error: error_text || content || 'Request failed',
                    latency: latency_ms || Date.now() - startTime,
                  }))
                  
                  // Cleanup  
                  if (timerRef.current) clearInterval(timerRef.current)
                  if (channelRef.current) channelRef.current.unsubscribe()
                }
              }
            }
          )
          .subscribe()

        console.log('Realtime subscription created for requestId:', requestId)
        
      } catch (realtimeError) {
        console.warn('Realtime subscription failed, using polling only:', realtimeError)
      }

      // 4. Fallback polling (runs regardless of Realtime success)
      let pollCount = 0
      const maxPollCount = 300 // 5 minutes at 1 second intervals
      
      timerRef.current = setInterval(async () => {
        pollCount++
        
        // Timeout after 5 minutes
        if (pollCount >= maxPollCount) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: 'Timeout waiting for result (5 minutes)',
            latency: Date.now() - startTime,
          }))
          
          if (timerRef.current) clearInterval(timerRef.current)
          if (channelRef.current) channelRef.current.unsubscribe()
          return
        }

        try {
          const statusResponse = await fetch(
            `/api/status?requestId=${encodeURIComponent(requestId)}`,
            { cache: 'no-store' }
          )
          
          if (statusResponse.ok) {
            const statusData = await statusResponse.json()
            
            if (statusData.status === 'completed') {
              setState(prev => ({
                ...prev,
                loading: false,
                result: statusData.output_text || '',
                latency: statusData.latency_ms || Date.now() - startTime,
              }))
              
              if (timerRef.current) clearInterval(timerRef.current)
              if (channelRef.current) channelRef.current.unsubscribe()
              
            } else if (statusData.status === 'failed') {
              setState(prev => ({
                ...prev,
                loading: false,
                error: statusData.error_text || 'Request failed',
                latency: statusData.latency_ms || Date.now() - startTime,
              }))
              
              if (timerRef.current) clearInterval(timerRef.current)
              if (channelRef.current) channelRef.current.unsubscribe()
            }
          }
        } catch (pollError) {
          console.warn('Polling failed:', pollError)
          // Continue polling on error
        }
      }, 1000) // Poll every second

      // Return the requestId for UI coordination
      return { requestId }
      
    } catch (error: any) {
      console.error('Send message error:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to send message',
      }))
      return null
    }
  }, [sessionId, supabase, reset])

  return {
    ...state,
    send,
    reset,
  }
}
