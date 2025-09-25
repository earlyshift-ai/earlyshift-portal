-- Fix RLS policies for chat_sessions to allow proper session creation

-- Drop the restrictive policy that was causing issues
DROP POLICY IF EXISTS "Users can manage their chat sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can create sessions in their tenants" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can view sessions in their tenants" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON public.chat_sessions;

-- Create more permissive policies that align with the required fields
CREATE POLICY "Users can view sessions in their tenants" ON public.chat_sessions
FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM public.memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can create sessions for accessible bots" ON public.chat_sessions
FOR INSERT WITH CHECK (
  -- User must be authenticated
  auth.uid() IS NOT NULL AND
  -- User ID must match authenticated user
  user_id = auth.uid() AND
  -- Tenant must be accessible to user
  tenant_id IN (
    SELECT tenant_id FROM public.memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  ) AND
  -- Bot must be accessible to the tenant
  (
    bot_id IN (
      SELECT bot_id FROM public.bot_access 
      WHERE tenant_id = chat_sessions.tenant_id AND enabled = true
    ) OR
    bot_id IN (
      SELECT id FROM public.bots 
      WHERE is_public = true AND status = 'active'
    )
  )
);

CREATE POLICY "Users can update their own sessions" ON public.chat_sessions
FOR UPDATE USING (
  user_id = auth.uid() AND
  tenant_id IN (
    SELECT tenant_id FROM public.memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

CREATE POLICY "Users can delete their own sessions" ON public.chat_sessions
FOR DELETE USING (
  user_id = auth.uid() AND
  tenant_id IN (
    SELECT tenant_id FROM public.memberships 
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

COMMENT ON POLICY "Users can create sessions for accessible bots" ON public.chat_sessions IS 
'Allows users to create chat sessions for bots they have access to within their tenants';
