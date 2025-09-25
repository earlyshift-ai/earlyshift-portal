import { NextRequest, NextResponse } from 'next/server'

/**
 * Session Reset API
 * Clears client-side session state to force creation of new session
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { botId } = body

    // Return instructions for client to clear localStorage
    const sessionKey = botId ? `sessionId:${botId}` : 'sessionId:default'

    return NextResponse.json({
      action: 'clear_storage',
      key: sessionKey,
      message: 'Session reset requested - clear localStorage and create new session'
    })

  } catch (error: any) {
    console.error('Session reset error:', error)
    return NextResponse.json(
      { error: 'Failed to reset session', details: error.message },
      { status: 500 }
    )
  }
}
