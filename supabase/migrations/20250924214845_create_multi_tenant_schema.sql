-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- CORE MULTI-TENANT SCHEMA
-- =============================================

-- Core tenant table
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug TEXT UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$'),
  name TEXT NOT NULL CHECK (length(name) >= 2 AND length(name) <= 100),
  domain TEXT UNIQUE, -- Custom domains (optional)
  
  -- Branding & config
  logo_url TEXT,
  primary_color TEXT DEFAULT '#000000',
  settings JSONB DEFAULT '{}',
  
  -- Status & limits
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  max_users INTEGER DEFAULT 10,
  max_bots INTEGER DEFAULT 5,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT CHECK (length(full_name) >= 2),
  avatar_url TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-tenant relationships with roles
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  
  -- Status and permissions
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  permissions JSONB DEFAULT '{}',
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(user_id, tenant_id)
);

-- Available chatbots in the system
CREATE TABLE public.bots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL CHECK (length(name) >= 2),
  description TEXT,
  avatar_url TEXT,
  
  -- Bot configuration
  model_config JSONB NOT NULL DEFAULT '{"model": "gpt-3.5-turbo"}',
  system_prompt TEXT,
  max_tokens INTEGER DEFAULT 1000,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  
  -- Status and availability
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  is_public BOOLEAN DEFAULT false, -- Public bots available to all tenants
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Which tenants have access to which bots
CREATE TABLE public.bot_access (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  
  -- Access configuration
  enabled BOOLEAN DEFAULT true,
  custom_name TEXT, -- Tenant can rename the bot
  custom_avatar_url TEXT,
  custom_config JSONB DEFAULT '{}', -- Override bot settings per tenant
  
  -- Usage limits per tenant
  daily_message_limit INTEGER,
  monthly_message_limit INTEGER,
  
  -- Audit fields
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  UNIQUE(tenant_id, bot_id)
);

-- Chat sessions
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  bot_id UUID NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
  
  -- Session metadata
  title TEXT DEFAULT 'New Chat',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted')),
  
  -- Session configuration (inherited from bot + overrides)
  session_config JSONB DEFAULT '{}',
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  
  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL CHECK (length(content) > 0),
  
  -- Optional metadata
  metadata JSONB DEFAULT '{}', -- Token count, model used, etc.
  
  -- Message status
  status TEXT DEFAULT 'delivered' CHECK (status IN ('pending', 'delivered', 'failed')),
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) -- For user messages
);

-- Usage tracking for billing/limits
CREATE TABLE public.usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  bot_id UUID REFERENCES bots(id) ON DELETE SET NULL,
  session_id UUID REFERENCES chat_sessions(id) ON DELETE SET NULL,
  
  -- Usage metrics
  event_type TEXT NOT NULL CHECK (event_type IN ('message_sent', 'session_created', 'user_login')),
  tokens_used INTEGER DEFAULT 0,
  cost_cents INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit table for security events
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Critical indexes for performance
CREATE INDEX idx_memberships_user_tenant 
  ON public.memberships (user_id, tenant_id) 
  WHERE status = 'active';

CREATE INDEX idx_memberships_tenant_role 
  ON public.memberships (tenant_id, role) 
  WHERE status = 'active';

CREATE INDEX idx_chat_sessions_tenant_user 
  ON public.chat_sessions (tenant_id, user_id, created_at DESC);

CREATE INDEX idx_messages_session_created 
  ON public.messages (session_id, created_at ASC);

CREATE INDEX idx_bot_access_tenant_enabled 
  ON public.bot_access (tenant_id, enabled) 
  WHERE enabled = true;

CREATE INDEX idx_usage_logs_tenant_date 
  ON public.usage_logs (tenant_id, created_at DESC);

-- Partial indexes for active records only
CREATE INDEX idx_tenants_active_slug 
  ON public.tenants (slug) 
  WHERE status = 'active';

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Helper function to get user's tenants
CREATE OR REPLACE FUNCTION public.user_tenants(user_uuid UUID DEFAULT auth.uid())
RETURNS UUID[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT tenant_id 
    FROM public.memberships 
    WHERE user_id = user_uuid 
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin/owner of tenant
CREATE OR REPLACE FUNCTION public.user_is_admin(tenant_uuid UUID, user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM public.memberships 
    WHERE user_id = user_uuid 
    AND tenant_id = tenant_uuid 
    AND role IN ('admin', 'owner')
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tenant by slug (used in middleware)
CREATE OR REPLACE FUNCTION public.get_tenant_by_slug(tenant_slug TEXT)
RETURNS TABLE(
  id UUID,
  name TEXT,
  slug TEXT,
  domain TEXT,
  logo_url TEXT,
  primary_color TEXT,
  settings JSONB,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id, t.name, t.slug, t.domain,
    t.logo_url, t.primary_color, t.settings, t.status
  FROM public.tenants t
  WHERE t.slug = tenant_slug AND t.status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's tenant memberships with roles
CREATE OR REPLACE FUNCTION public.get_user_memberships(user_uuid UUID DEFAULT auth.uid())
RETURNS TABLE(
  tenant_id UUID,
  tenant_slug TEXT,
  tenant_name TEXT,
  role TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.tenant_id,
    t.slug,
    t.name,
    m.role,
    m.status
  FROM public.memberships m
  JOIN public.tenants t ON t.id = m.tenant_id
  WHERE m.user_id = user_uuid 
  AND m.status = 'active'
  AND t.status = 'active'
  ORDER BY m.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely create a new chat session
CREATE OR REPLACE FUNCTION public.create_chat_session(
  p_tenant_id UUID,
  p_bot_id UUID,
  p_title TEXT DEFAULT 'New Chat'
)
RETURNS UUID AS $$
DECLARE
  session_id UUID;
  user_uuid UUID := auth.uid();
BEGIN
  -- Verify user has access to this tenant
  IF NOT EXISTS(
    SELECT 1 FROM public.memberships 
    WHERE user_id = user_uuid 
    AND tenant_id = p_tenant_id 
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'User does not have access to this tenant';
  END IF;
  
  -- Verify tenant has access to this bot
  IF NOT EXISTS(
    SELECT 1 FROM public.bot_access 
    WHERE tenant_id = p_tenant_id 
    AND bot_id = p_bot_id 
    AND enabled = true
  ) AND NOT EXISTS(
    SELECT 1 FROM public.bots 
    WHERE id = p_bot_id 
    AND is_public = true 
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Tenant does not have access to this bot';
  END IF;
  
  -- Create the session
  INSERT INTO public.chat_sessions (tenant_id, user_id, bot_id, title)
  VALUES (p_tenant_id, user_uuid, p_bot_id, p_title)
  RETURNING id INTO session_id;
  
  -- Log usage
  INSERT INTO public.usage_logs (tenant_id, user_id, bot_id, session_id, event_type)
  VALUES (p_tenant_id, user_uuid, p_bot_id, session_id, 'session_created');
  
  RETURN session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add a message to a session
CREATE OR REPLACE FUNCTION public.add_message(
  p_session_id UUID,
  p_role TEXT,
  p_content TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  message_id UUID;
  session_info RECORD;
  user_uuid UUID := auth.uid();
BEGIN
  -- Get session info and verify access
  SELECT s.tenant_id, s.user_id, s.bot_id, s.status
  INTO session_info
  FROM public.chat_sessions s
  WHERE s.id = p_session_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  
  IF session_info.status != 'active' THEN
    RAISE EXCEPTION 'Session is not active';
  END IF;
  
  -- For user messages, verify the user owns the session
  IF p_role = 'user' AND session_info.user_id != user_uuid THEN
    RAISE EXCEPTION 'User does not own this session';
  END IF;
  
  -- Insert the message
  INSERT INTO public.messages (session_id, role, content, metadata, created_by)
  VALUES (p_session_id, p_role, p_content, p_metadata, 
          CASE WHEN p_role = 'user' THEN user_uuid ELSE NULL END)
  RETURNING id INTO message_id;
  
  -- Update session timestamp
  UPDATE public.chat_sessions 
  SET last_message_at = NOW(), updated_at = NOW()
  WHERE id = p_session_id;
  
  -- Log usage for user messages
  IF p_role = 'user' THEN
    INSERT INTO public.usage_logs (
      tenant_id, user_id, bot_id, session_id, 
      event_type, tokens_used, metadata
    )
    VALUES (
      session_info.tenant_id, user_uuid, session_info.bot_id, p_session_id,
      'message_sent', 
      COALESCE((p_metadata->>'tokens_used')::INTEGER, 0),
      p_metadata
    );
  END IF;
  
  RETURN message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Service role function to create tenants
CREATE OR REPLACE FUNCTION public.system_create_tenant(
  p_slug TEXT,
  p_name TEXT,
  p_owner_email TEXT
)
RETURNS UUID AS $$
DECLARE
  tenant_uuid UUID;
  user_uuid UUID;
BEGIN
  -- This function should only be called by service role
  IF current_setting('role') != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Service role required';
  END IF;
  
  -- Create tenant
  INSERT INTO public.tenants (slug, name)
  VALUES (p_slug, p_name)
  RETURNING id INTO tenant_uuid;
  
  -- Find user
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = p_owner_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found: %', p_owner_email;
  END IF;
  
  -- Create user profile if not exists
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (user_uuid, p_owner_email, '')
  ON CONFLICT (id) DO NOTHING;
  
  -- Create owner membership
  INSERT INTO public.memberships (user_id, tenant_id, role, status)
  VALUES (user_uuid, tenant_uuid, 'owner', 'active');
  
  RETURN tenant_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  old_data JSONB;
  new_data JSONB;
  tenant_uuid UUID;
BEGIN
  -- Determine tenant_id from the record
  IF TG_OP = 'DELETE' THEN
    tenant_uuid := COALESCE(OLD.tenant_id, NULL);
  ELSE
    tenant_uuid := COALESCE(NEW.tenant_id, NULL);
  END IF;

  -- Prepare data
  IF TG_OP = 'DELETE' THEN
    old_data := to_jsonb(OLD);
    new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    old_data := NULL;
    new_data := to_jsonb(NEW);
  ELSE -- UPDATE
    old_data := to_jsonb(OLD);
    new_data := to_jsonb(NEW);
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    table_name, operation, old_data, new_data, 
    user_id, tenant_id
  ) VALUES (
    TG_TABLE_NAME, TG_OP, old_data, new_data,
    auth.uid(), tenant_uuid
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to sensitive tables
CREATE TRIGGER audit_memberships
  AFTER INSERT OR UPDATE OR DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_bot_access
  AFTER INSERT OR UPDATE OR DELETE ON public.bot_access
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Apply updated_at triggers
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_chat_sessions_updated_at
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- TENANTS policies
CREATE POLICY "Users can view their tenants" ON public.tenants
  FOR SELECT USING (
    id = ANY(public.user_tenants())
  );

CREATE POLICY "Only owners can update tenants" ON public.tenants
  FOR UPDATE USING (
    public.user_is_admin(id)
  );

-- USER_PROFILES policies
CREATE POLICY "Users can view their own profile" ON public.user_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON public.user_profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- MEMBERSHIPS policies
CREATE POLICY "Users can view memberships in their tenants" ON public.memberships
  FOR SELECT USING (
    tenant_id = ANY(public.user_tenants())
  );

CREATE POLICY "Admins can manage memberships" ON public.memberships
  FOR ALL USING (
    public.user_is_admin(tenant_id)
  );

-- BOTS policies (public bots + tenant-specific access)
CREATE POLICY "Users can view available bots" ON public.bots
  FOR SELECT USING (
    is_public = true OR 
    id IN (
      SELECT bot_id FROM public.bot_access 
      WHERE tenant_id = ANY(public.user_tenants()) 
      AND enabled = true
    )
  );

-- BOT_ACCESS policies
CREATE POLICY "Users can view their tenant's bot access" ON public.bot_access
  FOR SELECT USING (
    tenant_id = ANY(public.user_tenants())
  );

CREATE POLICY "Admins can manage bot access" ON public.bot_access
  FOR ALL USING (
    public.user_is_admin(tenant_id)
  );

-- CHAT_SESSIONS policies
CREATE POLICY "Users can view sessions in their tenants" ON public.chat_sessions
  FOR SELECT USING (
    tenant_id = ANY(public.user_tenants())
  );

CREATE POLICY "Users can create sessions in their tenants" ON public.chat_sessions
  FOR INSERT WITH CHECK (
    tenant_id = ANY(public.user_tenants()) AND
    user_id = auth.uid() AND
    -- Verify user has access to this bot
    EXISTS(
      SELECT 1 FROM public.bot_access 
      WHERE tenant_id = chat_sessions.tenant_id 
      AND bot_id = chat_sessions.bot_id 
      AND enabled = true
    )
  );

CREATE POLICY "Users can update their own sessions" ON public.chat_sessions
  FOR UPDATE USING (
    user_id = auth.uid() AND
    tenant_id = ANY(public.user_tenants())
  );

-- MESSAGES policies
CREATE POLICY "Users can view messages in their sessions" ON public.messages
  FOR SELECT USING (
    EXISTS(
      SELECT 1 FROM public.chat_sessions 
      WHERE id = messages.session_id 
      AND tenant_id = ANY(public.user_tenants())
    )
  );

CREATE POLICY "Users can create messages in their sessions" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.chat_sessions 
      WHERE id = messages.session_id 
      AND user_id = auth.uid()
      AND tenant_id = ANY(public.user_tenants())
    )
  );

-- USAGE_LOGS policies (read-only for users, admin-only for management)
CREATE POLICY "Admins can view tenant usage logs" ON public.usage_logs
  FOR SELECT USING (
    public.user_is_admin(tenant_id)
  );

CREATE POLICY "System can insert usage logs" ON public.usage_logs
  FOR INSERT WITH CHECK (true); -- Will be handled by service role

-- AUDIT_LOGS policies (admin-only)
CREATE POLICY "Admins can view tenant audit logs" ON public.audit_logs
  FOR SELECT USING (
    public.user_is_admin(tenant_id)
  );

-- =============================================
-- FUNCTION PERMISSIONS
-- =============================================

-- Prevent direct access to sensitive functions
REVOKE EXECUTE ON FUNCTION public.user_tenants FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_is_admin FROM PUBLIC;

-- Grant only to authenticated users
GRANT EXECUTE ON FUNCTION public.user_tenants TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_admin TO authenticated;

-- Public functions for all authenticated users
GRANT EXECUTE ON FUNCTION public.get_tenant_by_slug TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_memberships TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_message TO authenticated;

-- Service role only functions
REVOKE EXECUTE ON FUNCTION public.system_create_tenant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.system_create_tenant TO service_role;
