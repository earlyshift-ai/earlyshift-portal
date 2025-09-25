import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Simplified chat endpoint that avoids RLS issues
 * Uses service role for reliable message insertion
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

    // Generate unique request ID for tracking
    const requestId = `${Date.now()}-${messageId || crypto.randomUUID()}`

    console.log('💬 Simple Chat:', { 
      actualSessionId, 
      requestId, 
      text: text.slice(0, 50) + '...' 
    })

    // Insert user message using service role (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE
    
    if (!serviceRoleKey) {
      console.error('❌ SUPABASE_SERVICE_ROLE not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // 1. Insert user message
    const userMessageResponse = await fetch(
      `${supabaseUrl}/rest/v1/messages`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
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
      }
    )

    if (!userMessageResponse.ok) {
      const errorText = await userMessageResponse.text()
      console.error('❌ Failed to insert user message:', errorText)
    } else {
      console.log('✅ User message inserted')
    }

    // 2. Insert assistant placeholder
    const assistantMessageResponse = await fetch(
      `${supabaseUrl}/rest/v1/messages`,
      {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          session_id: actualSessionId,
          role: 'assistant',
          content: '🤖 Procesando tu consulta...',
          status: 'queued',
          request_id: requestId,
          metadata: {
            request_id: requestId,
            bot_id: botId,
            bot_name: botName,
            processing: true
          }
        })
      }
    )

    let assistantMessageId = 'error-placeholder'
    if (assistantMessageResponse.ok) {
      const assistantData = await assistantMessageResponse.json()
      assistantMessageId = assistantData[0]?.id || 'error-placeholder'
      console.log('✅ Assistant placeholder inserted:', assistantMessageId)
    } else {
      const errorText = await assistantMessageResponse.text()
      console.error('❌ Failed to insert assistant placeholder:', errorText)
    }

    // 3. Return ACK immediately
    const ackResponse = {
      requestId,
      status: 'queued',
      message: 'Message queued for processing',
      assistantMessageId
    }

    console.log('✅ Simple ACK Response:', ackResponse)

    // 4. Process in background with webhook
    setTimeout(async () => {
      try {
        console.log('🔄 Background: Starting webhook call for', requestId)
        
        const webhookUrl = process.env.N8N_WEBHOOK_URL
        const payload = {
          message: text,
          conversation_history: [],
          conversation_id: actualSessionId,
          session_id: actualSessionId,
          bot_id: botId || 'default-bot-id',
          bot_name: botName || 'Assistant',
          user_id: userId || 'unknown',
          request_id: requestId,
          assistant_message_id: assistantMessageId,
        }
        
        console.log('📤 Sending payload:', JSON.stringify(payload, null, 2))
        
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
          console.log('✅ Background: Webhook ACK received for', requestId)
          console.log('📝 n8n will update Supabase directly, no backend update needed')
          
          // n8n handles the Supabase update, so we don't do anything here
          
        } else {
          console.error('❌ Background: Webhook failed for', requestId, webhookResponse.status)
          
          // Only update on error
          if (assistantMessageId !== 'error-placeholder') {
            const updateResponse = await fetch(
              `${supabaseUrl}/rest/v1/messages?id=eq.${assistantMessageId}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  content: `Error: Webhook failed with status ${webhookResponse.status}`,
                  status: 'failed',
                  error_text: `Webhook returned ${webhookResponse.status}`,
                })
              }
            )
          }
        }
      } catch (error: any) {
        console.error('❌ Background webhook error:', error)
      }
    }, 100)

    // Return ACK immediately
    return NextResponse.json(ackResponse, { status: 202 })

  } catch (error: any) {
    console.error('Simple chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    )
  }
}
