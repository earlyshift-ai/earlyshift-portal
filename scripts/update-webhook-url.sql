-- Update webhook URL for Cooke Chile Assistant
-- Replace 'YOUR_N8N_WEBHOOK_URL_HERE' with your actual n8n webhook URL

UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{webhook_url}',
  '"YOUR_N8N_WEBHOOK_URL_HERE"'::jsonb
)
WHERE name = 'Cooke Chile Assistant';

-- Verify the update
SELECT 
  name,
  (model_config->>'webhook_url') as webhook_url,
  (model_config->>'model') as model_type,
  status
FROM public.bots 
WHERE name = 'Cooke Chile Assistant';
