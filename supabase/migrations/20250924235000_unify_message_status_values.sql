-- Unify message status values to support both original and async patterns
-- Remove conflicting check constraints and create unified constraint

-- Drop existing status constraints
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_status_check;

-- Create unified status constraint that supports both patterns
ALTER TABLE public.messages 
ADD CONSTRAINT messages_status_check 
CHECK (status IN ('pending', 'delivered', 'failed', 'queued', 'completed'));

-- Update default to use 'delivered' for user messages, 'queued' for async processing
-- The default will be set in application logic, not database

COMMENT ON CONSTRAINT messages_status_check ON public.messages IS 
'Unified status values: pending/delivered/failed (original), queued/completed/failed (async)';

-- For backwards compatibility, update any existing 'pending' messages to 'delivered'
UPDATE public.messages SET status = 'delivered' WHERE status = 'pending';

-- Create index on status for performance
CREATE INDEX IF NOT EXISTS messages_status_idx ON public.messages (status);

COMMENT ON COLUMN public.messages.status IS 
'Message status: delivered (user messages), queued/completed/failed (async processing)';
