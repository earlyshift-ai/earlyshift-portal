-- =============================================
-- MOCK DATA SETUP FOR COOKE CHILE
-- =============================================

-- First, let's create the Cooke Chile tenant
INSERT INTO public.tenants (
  id, 
  slug, 
  name, 
  primary_color, 
  settings, 
  status,
  max_users,
  max_bots
) VALUES (
  '20000000-0000-0000-0000-000000000001',
  'cooke',
  'Cooke Chile',
  '#2563EB', -- Nice blue color
  '{
    "theme": "light",
    "features": {
      "chat_history": true,
      "file_upload": true,
      "webhook_integration": true
    },
    "webhook_settings": {
      "enabled": true,
      "timeout": 30000,
      "retry_attempts": 3
    }
  }',
  'active',
  25, -- Higher limit for Cooke Chile
  10
) ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  primary_color = EXCLUDED.primary_color,
  settings = EXCLUDED.settings,
  max_users = EXCLUDED.max_users,
  max_bots = EXCLUDED.max_bots;

-- Create a webhook-enabled chatbot for Cooke Chile
INSERT INTO public.bots (
  id,
  name,
  description,
  avatar_url,
  model_config,
  system_prompt,
  status,
  is_public
) VALUES (
  '30000000-0000-0000-0000-000000000001',
  'Cooke Chile Assistant',
  'Specialized assistant for Cooke Chile operations, aquaculture insights, and business support',
  null, -- Will be set later if needed
  '{
    "model": "webhook",
    "webhook_url": "https://your-webhook-endpoint.com/api/chat/cooke",
    "webhook_method": "POST",
    "webhook_headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer webhook-token-here"
    },
    "timeout": 30000,
    "max_tokens": 2000,
    "temperature": 0.7,
    "supports_streaming": true
  }',
  'You are the Cooke Chile Assistant, an AI specialized in aquaculture, salmon farming, and business operations for Cooke Chile. You have deep knowledge about:

- Sustainable aquaculture practices
- Chilean salmon farming regulations
- Environmental compliance and monitoring
- Fish health and veterinary care
- Feed optimization and nutrition
- Harvest and processing operations
- Market trends in aquaculture
- Safety protocols and procedures

Always provide accurate, helpful information relevant to aquaculture operations. When discussing technical topics, be precise but accessible. If you need specific operational data or real-time information, let users know they should consult current systems or specialists.',
  'active',
  false -- Private bot, only for specific tenants
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  model_config = EXCLUDED.model_config,
  system_prompt = EXCLUDED.system_prompt;

-- Grant Cooke Chile access to their specialized bot
INSERT INTO public.bot_access (
  id,
  tenant_id,
  bot_id,
  enabled,
  custom_name,
  custom_config,
  daily_message_limit,
  monthly_message_limit
) VALUES (
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001', -- Cooke Chile tenant
  '30000000-0000-0000-0000-000000000001', -- Cooke Chile Assistant bot
  true,
  'Cooke Assistant', -- Shorter name for UI
  '{
    "priority": "high",
    "features": {
      "voice_input": false,
      "file_attachments": true,
      "data_export": true
    }
  }',
  200, -- 200 messages per day
  5000 -- 5000 messages per month
) ON CONFLICT (id) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  custom_name = EXCLUDED.custom_name,
  custom_config = EXCLUDED.custom_config,
  daily_message_limit = EXCLUDED.daily_message_limit,
  monthly_message_limit = EXCLUDED.monthly_message_limit;

-- Note: Will add access to general assistant bots later when they exist

-- Note: User profile and membership will be created when the user first logs in
-- The system will automatically create these based on the auth.users table

-- Function to set up user for Cooke Chile (to be called after user signs up)
CREATE OR REPLACE FUNCTION public.setup_cooke_chile_user(user_email TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  user_uuid UUID;
  tenant_uuid UUID := '20000000-0000-0000-0000-000000000001';
BEGIN
  -- Find the user by email
  SELECT id INTO user_uuid 
  FROM auth.users 
  WHERE email = user_email;
  
  IF user_uuid IS NULL THEN
    RAISE EXCEPTION 'User not found: %', user_email;
  END IF;
  
  -- Create user profile if it doesn't exist
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (user_uuid, user_email, 'Andrés Parodi')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  
  -- Create owner membership for Cooke Chile
  INSERT INTO public.memberships (user_id, tenant_id, role, status, created_by)
  VALUES (user_uuid, tenant_uuid, 'owner', 'active', user_uuid)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    status = EXCLUDED.status;
  
  -- Log the membership creation
  INSERT INTO public.usage_logs (tenant_id, user_id, event_type, metadata)
  VALUES (tenant_uuid, user_uuid, 'user_login', '{"setup": "initial_cooke_chile_setup"}');
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.setup_cooke_chile_user TO authenticated;

-- If the user already exists, set them up now
DO $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'andres@earlyshift.ai') INTO user_exists;
  
  IF user_exists THEN
    PERFORM public.setup_cooke_chile_user('andres@earlyshift.ai');
    RAISE NOTICE 'Cooke Chile setup completed for andres@earlyshift.ai';
  ELSE
    RAISE NOTICE 'User andres@earlyshift.ai not found. Setup function is ready for when user signs up.';
  END IF;
END $$;
