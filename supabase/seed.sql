-- =============================================
-- SEED DATA FOR MULTI-TENANT PORTAL
-- =============================================

-- Insert sample bots (these will be available to all tenants)
INSERT INTO public.bots (id, name, description, avatar_url, model_config, system_prompt, is_public, status) VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    'General Assistant',
    'A helpful AI assistant for general questions and tasks',
    null,
    '{"model": "gpt-3.5-turbo", "max_tokens": 1000, "temperature": 0.7}',
    'You are a helpful AI assistant. Be concise, accurate, and friendly in your responses.',
    true,
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    'Code Helper',
    'Specialized assistant for programming and code review',
    null,
    '{"model": "gpt-4", "max_tokens": 2000, "temperature": 0.3}',
    'You are an expert programming assistant. Help users with code, debugging, and technical questions. Always explain your reasoning and provide working examples.',
    true,
    'active'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    'Business Advisor',
    'AI assistant specialized in business strategy and analysis',
    null,
    '{"model": "gpt-4", "max_tokens": 1500, "temperature": 0.5}',
    'You are a business strategy consultant. Provide practical, actionable advice for business decisions, market analysis, and strategic planning.',
    false,
    'active'
  );

-- Insert demo tenant
INSERT INTO public.tenants (id, slug, name, primary_color, settings, status) VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'demo',
    'Demo Company',
    '#3B82F6',
    '{"theme": "light", "features": {"chat_history": true, "file_upload": false}}',
    'active'
  );

-- Note: User profiles and memberships will be created when users sign up
-- The system_create_tenant function should be used for creating new tenants in production

-- Grant public bots access to demo tenant
INSERT INTO public.bot_access (tenant_id, bot_id, enabled, custom_name) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', true, null),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', true, 'Development Assistant');

-- Insert Business Advisor bot access for demo tenant (paid feature example)
INSERT INTO public.bot_access (tenant_id, bot_id, enabled, custom_name, daily_message_limit) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', true, 'Strategic Advisor', 10);
