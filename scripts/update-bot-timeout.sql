-- Update bot timeout to 5 minutes for AI agent processing
UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{timeout}',
  '300000'::jsonb
)
WHERE name = 'Cooke Chile Assistant';

-- Verify the update
SELECT 
  name,
  (model_config->>'timeout') as timeout_ms,
  (model_config->>'webhook_url') as webhook_url,
  status
FROM public.bots 
WHERE name = 'Cooke Chile Assistant';
