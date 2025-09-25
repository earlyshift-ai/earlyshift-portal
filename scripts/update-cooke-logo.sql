-- Update Cooke Chile tenant with logo URL
-- You can run this in the Supabase SQL Editor or via CLI

UPDATE public.tenants 
SET 
  logo_url = 'https://your-logo-url-here.com/cooke-chile-logo.png',
  updated_at = NOW()
WHERE slug = 'cooke';

-- Verify the update
SELECT 
  id,
  slug,
  name,
  logo_url,
  primary_color,
  settings,
  max_users,
  max_bots,
  status
FROM public.tenants 
WHERE slug = 'cooke';
