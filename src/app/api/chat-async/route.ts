import { NextRequest, NextResponse } from 'next/server'

/**
 * Async chat endpoint using ACK pattern
 * Sends message to n8n and receives immediate ACK (202)
 * Processing continues in background, result via Realtime/polling
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Validate required fields
    const { sessionId, messageId, userId, text } = body
    if (!sessionId || !text) {
      return NextResponse.json(
        { error: 'Missing required fields: sessionId, text' },
        { status: 400 }
      )
    }

    // Send to n8n webhook for ACK + background processing
    const webhookUrl = process.env.N8N_WEBHOOK_URL
    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'N8N_WEBHOOK_URL not configured' },
        { status: 500 }
      )
    }

    console.log('Sending async request to n8n:', { sessionId, messageId, text: text.slice(0, 100) + '...' })

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        messageId: messageId || crypto.randomUUID(),
        userId: userId || 'unknown',
        text,
        meta: body.meta || {},
      }),
      // Short timeout for ACK - n8n should respond quickly
      signal: AbortSignal.timeout(10000), // 10 seconds max for ACK
    })

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`)
    }

    // Expect ACK response: { requestId, status: 'queued' }
    const ackData = await response.json()
    
    console.log('Received ACK from n8n:', ackData)

    // Return ACK to client
    return NextResponse.json(ackData, { status: 202 })

  } catch (error: any) {
    console.error('Chat async API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to queue message for processing',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
