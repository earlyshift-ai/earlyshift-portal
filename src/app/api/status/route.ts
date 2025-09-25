import { NextRequest, NextResponse } from 'next/server'

/**
 * Status endpoint for polling fallback
 * Checks message status in Supabase by request_id
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      )
    }

    // Query Supabase for message status
    const response = await fetch(
      `${supabaseUrl}/rest/v1/messages?request_id=eq.${encodeURIComponent(requestId)}&select=status,content,error_text,latency_ms`,
      {
        method: 'GET',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Prefer': 'return=representation',
        },
        cache: 'no-store', // Always fetch fresh data
      }
    )

    if (!response.ok) {
      throw new Error(`Supabase query failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const message = data?.[0]

    if (!message) {
      // Message not found, might still be queued
      return NextResponse.json({ 
        status: 'queued',
        message: 'Request not found, might still be processing'
      })
    }

    // Return message status
    return NextResponse.json({
      status: message.status,
      output_text: message.content, // Map content to output_text for consistency
      error_text: message.error_text,
      latency_ms: message.latency_ms,
    })

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
