-- Extend messages table for async processing
-- Add columns for ACK + background processing pattern

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS request_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('queued','completed','failed')) DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS error_text text,
  ADD COLUMN IF NOT EXISTS latency_ms integer;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS messages_session_idx ON public.messages (session_id);
CREATE INDEX IF NOT EXISTS messages_status_idx ON public.messages (status);
CREATE INDEX IF NOT EXISTS messages_request_id_idx ON public.messages (request_id);

-- Update RLS policies to handle async messages
-- Allow users to read their async message status
DO $$
BEGIN
  -- Only create policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'messages' AND policyname = 'Users can read async message status'
  ) THEN
    CREATE POLICY "Users can read async message status"
    ON public.messages FOR SELECT
    USING (
      session_id IN (
        SELECT cs.id 
        FROM public.chat_sessions cs
        JOIN public.bot_access ba ON cs.bot_id = ba.bot_id
        JOIN public.memberships m ON ba.tenant_id = m.tenant_id
        WHERE m.user_id = auth.uid()
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public.messages.request_id IS 'Unique identifier for async processing tracking';
COMMENT ON COLUMN public.messages.status IS 'Processing status: queued, completed, failed';
COMMENT ON COLUMN public.messages.error_text IS 'Error message if status is failed';
COMMENT ON COLUMN public.messages.latency_ms IS 'Processing time in milliseconds';
