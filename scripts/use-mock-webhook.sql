-- Temporarily use mock webhook for testing
-- This allows you to test the chat interface while setting up your n8n webhook

UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{webhook_url}',
  '"http://localhost:3004/api/webhook/mock"'::jsonb
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
