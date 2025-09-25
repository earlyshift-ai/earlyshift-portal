import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const query = searchParams.get('q')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required parameter: q' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Get current user - RLS will handle filtering by user automatically
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Call the RLS-based search function (no user/tenant params needed)
    const { data, error } = await supabase.rpc('search_chat_sessions', {
      search_query: query,
      result_limit: limit
    })

    if (error) {
      console.error('Search error:', error)
      return NextResponse.json(
        { error: 'Search failed', details: error.message },
        { status: 500 }
      )
    }

    // Format the results for frontend
    const formattedResults = data?.map((result: any) => ({
      id: result.session_id,
      title: result.session_title,
      botName: result.bot_name,
      lastMessageAt: result.last_message_at,
      createdAt: result.created_at,
      matchType: result.match_type,
      matchedContent: result.matched_content,
      relevanceScore: result.relevance_score
    })) || []

    return NextResponse.json({
      results: formattedResults,
      query,
      count: formattedResults.length
    })

  } catch (error: any) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error.message },
      { status: 500 }
    )
  }
}