-- Verification script for Cooke Chile setup
-- Run this in Supabase SQL Editor to verify everything is set up correctly

-- 1. Check Cooke Chile tenant
SELECT 
  'TENANT' as type,
  id,
  slug,
  name,
  logo_url,
  primary_color,
  status,
  max_users,
  max_bots
FROM public.tenants 
WHERE slug = 'cooke';

-- 2. Check user profile for andres@earlyshift.ai
SELECT 
  'USER_PROFILE' as type,
  up.id,
  up.email,
  up.full_name,
  up.created_at
FROM public.user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE au.email = 'andres@earlyshift.ai';

-- 3. Check membership
SELECT 
  'MEMBERSHIP' as type,
  m.id,
  m.role,
  m.status,
  t.name as tenant_name,
  up.email as user_email
FROM public.memberships m
JOIN public.tenants t ON t.id = m.tenant_id
JOIN public.user_profiles up ON up.id = m.user_id
WHERE t.slug = 'cooke';

-- 4. Check Cooke Chile Assistant bot
SELECT 
  'BOT' as type,
  id,
  name,
  description,
  status,
  is_public,
  (model_config->>'model') as model_type,
  (model_config->>'webhook_url') as webhook_url
FROM public.bots 
WHERE name = 'Cooke Chile Assistant';

-- 5. Check bot access for Cooke Chile
SELECT 
  'BOT_ACCESS' as type,
  ba.id,
  t.name as tenant_name,
  b.name as bot_name,
  ba.enabled,
  ba.custom_name,
  ba.daily_message_limit,
  ba.monthly_message_limit
FROM public.bot_access ba
JOIN public.tenants t ON t.id = ba.tenant_id
JOIN public.bots b ON b.id = ba.bot_id
WHERE t.slug = 'cooke';

-- 6. Check usage logs
SELECT 
  'USAGE_LOG' as type,
  ul.event_type,
  ul.created_at,
  t.name as tenant_name,
  up.email as user_email
FROM public.usage_logs ul
JOIN public.tenants t ON t.id = ul.tenant_id
LEFT JOIN public.user_profiles up ON up.id = ul.user_id
WHERE t.slug = 'cooke'
ORDER BY ul.created_at DESC
LIMIT 5;

-- 7. Test the helper functions
SELECT 
  'HELPER_FUNCTIONS' as type,
  'get_tenant_by_slug' as function_name,
  (SELECT count(*) FROM public.get_tenant_by_slug('cooke')) as result_count;

-- 8. Summary
SELECT 
  'SUMMARY' as type,
  'Setup Complete' as status,
  (SELECT name FROM public.tenants WHERE slug = 'cooke') as tenant_name,
  (SELECT count(*) FROM public.memberships m JOIN public.tenants t ON t.id = m.tenant_id WHERE t.slug = 'cooke') as member_count,
  (SELECT count(*) FROM public.bot_access ba JOIN public.tenants t ON t.id = ba.tenant_id WHERE t.slug = 'cooke') as bot_access_count;
