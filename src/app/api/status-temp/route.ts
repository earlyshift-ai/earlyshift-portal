import { NextRequest, NextResponse } from 'next/server'

/**
 * Temporary status endpoint for testing ACK pattern
 * Returns mock status for any requestId
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const requestId = searchParams.get('requestId')
    
    if (!requestId) {
      return NextResponse.json(
        { error: 'Missing requestId parameter' },
        { status: 400 }
      )
    }

    console.log('📊 Status check for:', requestId)

    // Check if we have a real result from the webhook
    global.webhookResults = global.webhookResults || new Map()
    const cachedResult = global.webhookResults.get(requestId)
    
    if (cachedResult) {
      console.log('✅ Found cached result for', requestId, 'status:', cachedResult.status)
      return NextResponse.json(cachedResult)
    }

    // For demo purposes, simulate different states based on time
    const now = Date.now()
    const requestTime = parseInt(requestId.split('-')[0]) || now
    const elapsed = now - requestTime

    // Still processing - check again in a moment
    if (elapsed < 10000) { // Give up to 10 seconds for webhook to complete
      return NextResponse.json({
        status: 'queued',
        message: 'Processing your request...',
      })
    } else {
      // Timeout - no result received
      return NextResponse.json({
        status: 'failed',
        error_text: 'Request timed out - no response received from AI agent',
        latency_ms: elapsed,
      })
    }

  } catch (error: any) {
    console.error('Status API error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to check message status',
        details: error.message 
      },
      { status: 500 }
    )
  }
}
