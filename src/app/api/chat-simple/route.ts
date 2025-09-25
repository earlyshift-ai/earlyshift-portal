import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { waitUntil } from '@vercel/functions'

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
      
      // First check if session needs title update
      const sessionCheckResponse = await fetch(
        `${supabaseUrl}/rest/v1/chat_sessions?id=eq.${actualSessionId}&select=title`,
        {
          method: 'GET',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          }
        }
      )
      
      let updateData: any = {
        last_message_at: new Date().toISOString()
      }
      
      if (sessionCheckResponse.ok) {
        const sessions = await sessionCheckResponse.json()
        const currentTitle = sessions[0]?.title
        
        // Only update title if it's empty or default
        if (!currentTitle || currentTitle === 'New Chat' || currentTitle === '') {
          updateData.title = text.slice(0, 100) // Use first 100 chars as title
        }
      }
      
      // Update session with last message time and potentially title
      const updateSessionResponse = await fetch(
        `${supabaseUrl}/rest/v1/chat_sessions?id=eq.${actualSessionId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        }
      )
      
      if (updateSessionResponse.ok) {
        console.log('✅ Session updated:', updateData)
      }
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

    // Return ACK immediately for fast UI response
    const response = NextResponse.json(ackResponse, { status: 202 })

    // 4. Trigger webhook in background using fetch without await (fire-and-forget)
    // This ensures the ACK is returned immediately while webhook processes asynchronously
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (webhookUrl) {
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
      
      console.log('🔄 Triggering webhook for', requestId)
      console.log('📤 Payload:', JSON.stringify(payload, null, 2))
      
      // Use waitUntil to ensure webhook completes in Vercel
      const webhookPromise = fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // 30 seconds timeout
      }).then(async (webhookResponse) => {
        if (webhookResponse.ok) {
          const result = await webhookResponse.json()
          console.log('✅ Webhook completed for', requestId)
        } else {
          console.error('❌ Webhook failed for', requestId, webhookResponse.status)
          
          // Update message with error status
          if (assistantMessageId !== 'error-placeholder') {
            await fetch(
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
      }).catch(async (error) => {
        console.error('❌ Webhook error for', requestId, error)
        
        // Update message with error status
        if (assistantMessageId !== 'error-placeholder') {
          try {
            await fetch(
              `${supabaseUrl}/rest/v1/messages?id=eq.${assistantMessageId}`,
              {
                method: 'PATCH',
                headers: {
                  'apikey': serviceRoleKey,
                  'Authorization': `Bearer ${serviceRoleKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  content: `Error: ${error.message}`,
                  status: 'failed',
                  error_text: error.message,
                })
              }
            )
          } catch (updateError) {
            console.error('Failed to update message with error:', updateError)
          }
        }
      })
      
      // Use waitUntil to keep the function running after response
      // This ensures the webhook completes even after we return the ACK
      waitUntil(webhookPromise)
    } else {
      console.error('❌ N8N_WEBHOOK_URL not configured')
    }

    return response

  } catch (error: any) {
    console.error('Simple chat API error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    )
  }
}
