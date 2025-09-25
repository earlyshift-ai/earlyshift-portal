import { NextRequest, NextResponse } from 'next/server'

declare global {
  var webhookResults: Map<string, any> | undefined
}

/**
 * Temporary ACK endpoint that works with existing n8n webhook
 * Converts new ACK pattern to work with your current webhook structure
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate required fields
    const { conversationId, sessionId, messageId, userId, text, botId, botName } = body
    const actualSessionId = sessionId || conversationId // Support both field names
    
    if (!actualSessionId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId/conversationId, text' },
        { status: 400 }
      )
    }

    // Generate unique request ID for tracking
    const requestId = `${Date.now()}-${messageId || crypto.randomUUID()}`

    console.log('🚀 ACK Pattern: Sending to existing webhook:', { 
      actualSessionId, 
      requestId, 
      text: text.slice(0, 50) + '...' 
    })

    // 1. Return ACK immediately (this simulates what n8n should do)
    const ackResponse = {
      requestId,
      status: 'queued',
      message: 'Message queued for processing'
    }

    console.log('✅ ACK Response sent:', ackResponse)

    // 2. Process in background with your real webhook
    setTimeout(async () => {
      try {
        console.log('🔄 Background: Starting real webhook call for', requestId)
        
        // Call your actual n8n webhook with the payload structure it expects
        const webhookUrl = process.env.N8N_WEBHOOK_URL
        const payload = {
          message: text,
          conversation_history: [], // Add previous messages if needed
          // Additional context for enhanced version
          conversation_id: actualSessionId,
          session_id: actualSessionId, // Ensure session ID is included
          bot_id: botId || 'default-bot-id',
          bot_name: botName || 'Assistant',
          user_id: userId || 'unknown',
          request_id: requestId,
        }
        
        console.log('📤 Sending enhanced payload:', JSON.stringify(payload, null, 2))
        
        const webhookResponse = await fetch(webhookUrl!, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(300000), // 5 minutes timeout
        })

        if (webhookResponse.ok) {
          const result = await webhookResponse.json()
          console.log('✅ Background: Real webhook completed for', requestId)
          console.log('📝 Webhook result:', result.response?.slice(0, 100) + '...')
          
          // Store the real response in a temporary cache (in production, use Supabase)
          // For now, we'll use a global variable as a simple cache
          global.webhookResults = global.webhookResults || new Map()
          global.webhookResults.set(requestId, {
            status: 'completed',
            output_text: result.response || 'Response received but no content',
            latency_ms: Date.now() - parseInt(requestId.split('-')[0]),
            completed_at: new Date().toISOString()
          })
          
          console.log('💾 Cached result for', requestId)
          
        } else {
          console.error('❌ Background: Real webhook failed for', requestId, webhookResponse.status)
          
          // Store error in cache
          global.webhookResults = global.webhookResults || new Map()
          global.webhookResults.set(requestId, {
            status: 'failed',
            error_text: `Webhook failed: ${webhookResponse.status}`,
            latency_ms: Date.now() - parseInt(requestId.split('-')[0])
          })
        }
      } catch (error) {
        console.error('❌ Background webhook error:', error)
      }
    }, 100) // Start background processing after 100ms

    // Return ACK immediately
    return NextResponse.json(ackResponse, { status: 202 })

  } catch (error: any) {
    console.error('❌ ACK API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to queue message for processing',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
