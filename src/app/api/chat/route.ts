import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'

export async function POST(req: NextRequest) {
  try {
    const { messages, botId, tenantId } = await req.json()

    if (!messages || !botId || !tenantId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this specific bot (considering user-specific permissions)
    const { data: hasAccess } = await supabase
      .rpc('user_has_bot_access', {
        p_user_id: user.id,
        p_tenant_id: tenantId,
        p_bot_id: botId
      })

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Bot not found or access denied' },
        { status: 403 }
      )
    }

    // Get bot details
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, name, model_config, system_prompt, status')
      .eq('id', botId)
      .eq('status', 'active')
      .single()

    if (botError || !bot) {
      return NextResponse.json(
        { error: 'Bot not found' },
        { status: 404 }
      )
    }
    const modelConfig = bot.model_config as Record<string, unknown>

    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Invalid message format' },
        { status: 400 }
      )
    }

    // Check if this is a webhook bot (n8n agent)
    if (modelConfig.model === 'webhook' && modelConfig.webhook_url) {
      return handleWebhookBot(modelConfig, lastMessage.content, messages, bot)
    } else {
      // Handle standard LLM bots
      return handleLLMBot(bot, messages)
    }

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleWebhookBot(
  modelConfig: Record<string, unknown>,
  userMessage: string,
  messages: Record<string, unknown>[],
  bot: Record<string, unknown>
) {
  try {
    const { webhook_url, webhook_headers = {}, timeout = 600000 } = modelConfig

    // Prepare the payload for n8n
    const payload = {
      message: userMessage,
      conversation_history: messages.slice(-10), // Last 10 messages for context
      bot_info: {
        id: bot.id,
        name: bot.name,
        system_prompt: bot.system_prompt
      },
      timestamp: new Date().toISOString()
    }

    console.log('Sending webhook payload to:', webhook_url)
    console.log('Payload size:', JSON.stringify(payload).length, 'bytes')
    console.log('Timeout:', timeout, 'ms')

    // Set default headers
    const headers = {
      'Content-Type': 'application/json',
      ...(webhook_headers as Record<string, string> || {})
    }

    // Make webhook request to n8n
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.log(`Webhook timeout after ${timeout}ms`)
      controller.abort()
    }, timeout as number)

    const response = await fetch(webhook_url as string, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let errorMessage = `Webhook failed: ${response.status} ${response.statusText}`
      
      try {
        const errorData = await response.json()
        if (errorData.message) {
          errorMessage += ` - ${errorData.message}`
        }
        if (errorData.hint) {
          errorMessage += ` Hint: ${errorData.hint}`
        }
      } catch (e) {
        // If we can't parse the error response, just use the status
      }
      
      throw new Error(errorMessage)
    }

    // Handle empty or invalid JSON responses
    let result
    try {
      const responseText = await response.text()
      console.log('Raw webhook response:', responseText)
      
      if (!responseText.trim()) {
        console.log('Empty response from webhook')
        result = { response: 'I received your message but my response is being processed. Please try again in a moment.' }
      } else {
        result = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('Failed to parse webhook response:', parseError)
      result = { response: 'I received your message but had trouble formatting my response. Please try again.' }
    }

    // Check if n8n supports streaming
    if (modelConfig.supports_streaming && result.stream_url) {
      // Handle streaming response from n8n
      return handleStreamingWebhook(result.stream_url)
    } else {
      // Handle direct response
      const botResponse = result.response || result.message || result.text || result.output || 'I received your message but my response is being processed.'
      
      return NextResponse.json({
        content: botResponse,
        type: 'webhook'
      })
    }

  } catch (error) {
    console.error('Webhook error:', error)
    
    let errorMessage = "I'm sorry, I'm having trouble connecting to my AI agent right now. Please try again in a moment."
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = "La consulta está tomando más tiempo del esperado (más de 5 minutos). Esto puede deberse a una consulta muy compleja. Intenta con una pregunta más específica o divide tu consulta en partes más pequeñas."
      } else if (error.message.includes('timeout')) {
        errorMessage = "The AI agent response timed out. Please try again."
      } else if (error.message.includes('524')) {
        errorMessage = "La consulta es muy compleja y está tomando demasiado tiempo. Intenta dividir tu pregunta en partes más específicas. Por ejemplo, en lugar de pedir un 'análisis integral', pregunta sobre FCR, calidad, y costos por separado."
      } else {
        errorMessage += `\n\nError: ${error.message}`
      }
    }
    
    // Return error response
    return NextResponse.json({
      content: errorMessage,
      type: 'error'
    }, { status: 200 })
  }
}

async function handleStreamingWebhook(streamUrl: string) {
  try {
    const response = await fetch(streamUrl)
    
    if (!response.ok) {
      throw new Error('Streaming failed')
    }

    // Pass through the stream
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked'
      }
    })

  } catch (error) {
    console.error('Streaming webhook error:', error)
    return new Response('Error in streaming response', { status: 500 })
  }
}

async function handleLLMBot(bot: Record<string, unknown>, messages: Record<string, unknown>[]) {
  // For standard LLM bots, use OpenAI or other providers
  const systemPrompt = (bot.system_prompt as string) || 'You are a helpful assistant.'
  
  const result = streamText({
    model: openai('gpt-3.5-turbo'),
    system: systemPrompt,
    messages: messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    })),
  })

  return result.toTextStreamResponse()
}
