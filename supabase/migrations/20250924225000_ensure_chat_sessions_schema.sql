-- Ensure chat_sessions table exists with proper schema for session management

-- Add external_id column if it doesn't exist (for mapping external conversation IDs)
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS external_id text UNIQUE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS chat_sessions_user_id_idx ON public.chat_sessions (user_id);
CREATE INDEX IF NOT EXISTS chat_sessions_bot_id_idx ON public.chat_sessions (bot_id);
CREATE INDEX IF NOT EXISTS chat_sessions_external_id_idx ON public.chat_sessions (external_id);

-- Update RLS policies for chat_sessions
DROP POLICY IF EXISTS "Users can manage their chat sessions" ON public.chat_sessions;

CREATE POLICY "Users can manage their chat sessions"
ON public.chat_sessions FOR ALL
USING (
  user_id = auth.uid() OR
  user_id IS NULL -- Allow creation without user_id for guest sessions
);

-- Ensure messages table FK constraint exists
DO $$
BEGIN
  -- Check if FK constraint exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_session_id_fkey'
    AND table_name = 'messages'
  ) THEN
    -- Add FK constraint if it doesn't exist
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_session_id_fkey 
    FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

COMMENT ON COLUMN public.chat_sessions.external_id IS 'Optional external conversation ID for mapping';
COMMENT ON TABLE public.chat_sessions IS 'Chat sessions for managing conversation context and message grouping';
