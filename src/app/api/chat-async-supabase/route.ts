import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Enhanced ACK pattern that stores messages in Supabase for Realtime updates
 * This replaces the temp cache approach with proper database storage
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate required fields
    const { conversationId, sessionId, messageId, userId, text, botId, botName } = body
    const actualSessionId = sessionId || conversationId
    
    if (!actualSessionId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId/conversationId, text' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Generate unique request ID for tracking
    const requestId = `${Date.now()}-${messageId || crypto.randomUUID()}`

    console.log('🚀 Supabase ACK Pattern:', { 
      actualSessionId, 
      requestId, 
      text: text.slice(0, 50) + '...' 
    })

    // 1. Insert user message
    const { data: userMessage, error: userError } = await supabase
      .from('messages')
      .insert({
        session_id: actualSessionId,
        role: 'user',
        content: text,
        status: 'delivered',
        metadata: {
          user_id: userId,
          bot_id: botId,
          bot_name: botName
        }
      })
      .select('id')
      .single()

    if (userError) {
      console.error('Failed to insert user message:', userError)
      // Continue even if user message fails - the assistant message is more important
    }

    // 2. Insert assistant placeholder with request_id
    const { data: assistantPlaceholder, error: assistantError } = await supabase
      .from('messages')
      .insert({
        session_id: actualSessionId,
        role: 'assistant',
        content: '🤖 Procesando tu consulta...',
        status: 'queued',
        request_id: requestId,
        metadata: {
          request_id: requestId,
          user_message_id: userMessage?.id,
          bot_id: botId,
          bot_name: botName,
          processing: true
        }
      })
      .select('id, metadata')
      .single()

    if (assistantError) {
      console.error('Failed to insert assistant placeholder:', assistantError)
      console.error('Assistant error details:', JSON.stringify(assistantError, null, 2))
      
      // Continue even if assistant placeholder fails - return ACK anyway
      console.log('⚠️ Continuing without assistant placeholder due to error')
    }

    // 3. Return ACK immediately
    const ackResponse = {
      requestId,
      status: 'queued',
      message: 'Message queued for processing',
      assistantMessageId: assistantPlaceholder?.id || 'error-placeholder'
    }

    console.log('✅ ACK Response with Supabase storage:', ackResponse)

    // 4. Process in background with your real webhook
    setTimeout(async () => {
      try {
        console.log('🔄 Background: Starting real webhook call for', requestId)
        
        const webhookUrl = process.env.N8N_WEBHOOK_URL
        const payload = {
          message: text,
          conversation_history: [], // TODO: Add recent messages if needed
          conversation_id: actualSessionId,
          session_id: actualSessionId,
          bot_id: botId || 'default-bot-id',
          bot_name: botName || 'Assistant',
          user_id: userId || 'unknown',
          request_id: requestId,
          assistant_message_id: assistantPlaceholder?.id || 'error-placeholder', // For n8n to update directly
        }
        
        console.log('📤 Sending enhanced payload with message ID:', JSON.stringify(payload, null, 2))
        
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
          
          // Update the assistant message with the real response
          if (assistantPlaceholder?.id) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({
                content: result.response || 'Response received but no content',
                status: 'completed',
                latency_ms: Date.now() - parseInt(requestId.split('-')[0]),
                metadata: {
                  ...assistantPlaceholder.metadata || {},
                  processing: false,
                  completed_at: new Date().toISOString(),
                  latency_ms: Date.now() - parseInt(requestId.split('-')[0])
                }
              })
              .eq('id', assistantPlaceholder.id)
            
            if (updateError) {
              console.error('❌ Failed to update assistant message:', updateError)
            } else {
              console.log('💾 Assistant message updated in Supabase for', requestId)
            }
          } else {
            console.log('⚠️ No assistant placeholder to update')
          }
          
        } else {
          console.error('❌ Background: Real webhook failed for', requestId, webhookResponse.status)
          
          // Update with error status
          if (assistantPlaceholder?.id) {
            await supabase
              .from('messages')
              .update({
                content: `Error procesando la consulta: ${webhookResponse.status}`,
                status: 'failed',
                error_text: `Webhook failed: ${webhookResponse.status}`,
                latency_ms: Date.now() - parseInt(requestId.split('-')[0])
              })
              .eq('id', assistantPlaceholder.id)
          }
        }
      } catch (error: any) {
        console.error('❌ Background webhook error:', error)
        
        // Update with error status
        if (assistantPlaceholder?.id) {
          await supabase
            .from('messages')
            .update({
              content: `Error procesando la consulta: ${error.message}`,
              status: 'failed',
              error_text: error.message,
              latency_ms: Date.now() - parseInt(requestId.split('-')[0])
            })
            .eq('id', assistantPlaceholder.id)
        }
      }
    }, 100) // Start background processing after 100ms

    // Return ACK immediately
    return NextResponse.json(ackResponse, { status: 202 })

  } catch (error: any) {
    console.error('Chat async Supabase API error:', error)
    return NextResponse.json(
      { error: 'Failed to queue message for processing', details: error.message },
      { status: 500 }
    )
  }
}
