-- Add search functionality for chat sessions
-- This migration adds a function to search through session titles and message content

-- Enable pg_trgm extension for similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a function to search sessions by title and message content
CREATE OR REPLACE FUNCTION public.search_chat_sessions(
  search_query TEXT,
  user_uuid UUID,
  tenant_uuid UUID,
  result_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  session_id UUID,
  session_title TEXT,
  bot_name TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  match_type TEXT, -- 'title' or 'message'
  matched_content TEXT, -- snippet of matched content
  relevance_score REAL
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return empty if search query is empty
  IF search_query IS NULL OR trim(search_query) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH title_matches AS (
    -- Search in session titles
    SELECT 
      cs.id as session_id,
      cs.title as session_title,
      b.name as bot_name,
      cs.last_message_at,
      cs.created_at,
      'title'::TEXT as match_type,
      cs.title as matched_content,
      similarity(cs.title, search_query) as relevance_score
    FROM public.chat_sessions cs
    LEFT JOIN public.bots b ON cs.bot_id = b.id
    WHERE cs.user_id = user_uuid
      AND cs.tenant_id = tenant_uuid
      AND cs.status = 'active'
      AND (
        cs.title ILIKE '%' || search_query || '%'
        OR similarity(cs.title, search_query) > 0.1
      )
  ),
  message_matches AS (
    -- Search in message content
    SELECT DISTINCT ON (cs.id)
      cs.id as session_id,
      cs.title as session_title,
      b.name as bot_name,
      cs.last_message_at,
      cs.created_at,
      'message'::TEXT as match_type,
      substring(m.content, 1, 200) as matched_content,
      similarity(m.content, search_query) as relevance_score
    FROM public.messages m
    JOIN public.chat_sessions cs ON m.session_id = cs.id
    LEFT JOIN public.bots b ON cs.bot_id = b.id
    WHERE cs.user_id = user_uuid
      AND cs.tenant_id = tenant_uuid
      AND cs.status = 'active'
      AND m.content ILIKE '%' || search_query || '%'
    ORDER BY cs.id, m.created_at DESC
  )
  -- Combine and sort results
  SELECT * FROM (
    SELECT * FROM title_matches
    UNION
    SELECT * FROM message_matches
  ) combined_results
  ORDER BY 
    CASE 
      WHEN match_type = 'title' THEN 0
      ELSE 1
    END,
    relevance_score DESC,
    last_message_at DESC
  LIMIT result_limit;
END;
$$;

-- Create index for better text search performance if not exists
CREATE INDEX IF NOT EXISTS idx_messages_content_gin 
  ON public.messages USING gin(content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_title_gin 
  ON public.chat_sessions USING gin(title gin_trgm_ops);

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.search_chat_sessions TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.search_chat_sessions IS 
  'Search chat sessions by title and message content. Returns sessions matching the search query with relevance scoring.';