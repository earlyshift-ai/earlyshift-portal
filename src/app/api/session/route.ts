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
      // Check for recent duplicate sessions first
      const fiveMinutesAgo = new Date(Date.now() - 300000).toISOString()
      const { data: recentSessions } = await supabase
        .from('chat_sessions')
        .select('id, created_at')
        .eq('tenant_id', actualTenantId)
        .eq('user_id', currentUserId)
        .eq('bot_id', botId)
        .eq('status', 'active')
        .gte('created_at', fiveMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1)

      if (recentSessions && recentSessions.length > 0) {
        console.log('⚠️ Found recent session created less than 5 minutes ago, reusing:', recentSessions[0].id)
        sessionData = recentSessions[0]
      } else {
        // Create new session
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert({
            tenant_id: actualTenantId,
            user_id: currentUserId,
            bot_id: botId,
          })
          .select('id')
          .single()

        if (error) {
          console.error('Session creation error:', error)
          return NextResponse.json(
            { error: 'Failed to create session', details: error.message },
            { status: 500 }
          )
        }

        sessionData = data
      }
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
