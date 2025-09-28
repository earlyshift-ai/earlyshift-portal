import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Session Management API
 * Handles creation and retrieval of chat sessions
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { botId, externalId, userId, tenantId } = body

    if (!botId) {
      return NextResponse.json(
        { error: 'botId is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user if authenticated
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = userId || user?.id

    if (!currentUserId) {
      return NextResponse.json(
        { error: 'User must be authenticated' },
        { status: 401 }
      )
    }

    // Get user's tenants if tenantId not provided
    let actualTenantId = tenantId
    if (!actualTenantId) {
      const { data: memberships } = await supabase
        .rpc('get_user_memberships', { user_uuid: currentUserId })

      if (!memberships || memberships.length === 0) {
        return NextResponse.json(
          { error: 'User has no tenant access' },
          { status: 403 }
        )
      }

      // Use first tenant if multiple (should be handled by UI)
      actualTenantId = memberships[0].tenant_id
    }

    // Verify bot exists and user has access to it
    const { data: bot, error: botError } = await supabase
      .from('bots')
      .select('id, name')
      .eq('id', botId)
      .single()

    if (botError || !bot) {
      console.error('❌ Bot not found:', {
        error: botError,
        bot_id: botId,
      })
      return NextResponse.json(
        { error: 'Bot not found', details: botError?.message },
        { status: 404 }
      )
    }

    // Check if tenant has access to this bot
    const { data: botAccess } = await supabase
      .from('bot_access')
      .select('id')
      .eq('tenant_id', actualTenantId)
      .eq('bot_id', botId)
      .limit(1)

    if (!botAccess || botAccess.length === 0) {
      console.warn('⚠️ No bot_access record found, but proceeding anyway:', {
        tenant_id: actualTenantId,
        bot_id: botId,
      })
      // Don't fail here - some setups might not use bot_access table
    }

    let sessionData: any

    if (externalId) {
      // Upsert based on external_id
      const { data, error } = await supabase
        .from('chat_sessions')
        .upsert({
          external_id: externalId,
          tenant_id: actualTenantId,
          user_id: currentUserId,
          bot_id: botId,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'external_id',
          ignoreDuplicates: false,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Session upsert error:', error)
        return NextResponse.json(
          { error: 'Failed to create or update session', details: error.message },
          { status: 500 }
        )
      }

      sessionData = data
    } else {
      // ALWAYS create a new session when requested - no reuse logic
      // This ensures "New Chat" always creates a fresh conversation
      console.log('📝 Creating new session (no reuse):', {
        tenant_id: actualTenantId,
        user_id: currentUserId,
        bot_id: botId,
      })
      
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert({
          tenant_id: actualTenantId,
          user_id: currentUserId,
          bot_id: botId,
          status: 'active', // Explicitly set status
          title: 'New Chat', // Set default title
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message_at: new Date().toISOString(), // Add this field
        })
        .select('id')
        .single()

      if (error) {
        console.error('❌ Session creation error details:', {
          error: error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          tenant_id: actualTenantId,
          user_id: currentUserId,
          bot_id: botId,
        })
        return NextResponse.json(
          { error: 'Failed to create session', details: error.message, code: error.code },
          { status: 500 }
        )
      }

      sessionData = data
    }

    console.log('✅ Session created/updated:', sessionData.id)

    return NextResponse.json({
      sessionId: sessionData.id
    })

  } catch (error: any) {
    console.error('Session API error:', error)
    return NextResponse.json(
      { error: 'Session API failed', details: error.message },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Verify session exists and user has access
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, user_id, bot_id, external_id, created_at, updated_at')
      .eq('id', sessionId)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      sessionId: data.id,
      userId: data.user_id,
      botId: data.bot_id,
      externalId: data.external_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    })

  } catch (error: any) {
    console.error('Session GET error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve session', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'User must be authenticated' },
        { status: 401 }
      )
    }

    // Verify user owns this session and update status to 'deleted'
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ 
        status: 'deleted',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', user.id) // Ensure user owns the session
      .select('id')
      .single()

    if (error) {
      console.error('Session deletion error:', error)
      return NextResponse.json(
        { error: 'Failed to delete session', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    console.log('✅ Session deleted:', sessionId)

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    })

  } catch (error: any) {
    console.error('Session DELETE error:', error)
    return NextResponse.json(
      { error: 'Failed to delete session', details: error.message },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId parameter' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid title is required' },
        { status: 400 }
      )
    }

    if (title.length > 100) {
      return NextResponse.json(
        { error: 'Title cannot exceed 100 characters' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'User must be authenticated' },
        { status: 401 }
      )
    }

    // Update session title
    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ 
        title: title.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .eq('user_id', user.id) // Ensure user owns the session
      .select('id, title')
      .single()

    if (error) {
      console.error('Session update error:', error)
      return NextResponse.json(
        { error: 'Failed to update session', details: error.message },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      )
    }

    console.log('✅ Session title updated:', sessionId, 'to:', title.trim())

    return NextResponse.json({
      success: true,
      sessionId: data.id,
      title: data.title,
      message: 'Session title updated successfully'
    })

  } catch (error: any) {
    console.error('Session PUT error:', error)
    return NextResponse.json(
      { error: 'Failed to update session', details: error.message },
      { status: 500 }
    )
  }
}
