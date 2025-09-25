-- Temporarily use mock webhook while fixing n8n
UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{webhook_url}',
  '"http://localhost:3004/api/webhook/mock"'::jsonb
)
WHERE name = 'Cooke Chile Assistant';

-- To switch back to n8n later:
-- UPDATE public.bots 
-- SET model_config = jsonb_set(
--   model_config,
--   '{webhook_url}',
--   '"https://blusolutions.app.n8n.cloud/webhook-test/59ea52a7-cd19-4c8a-a432-3dd0b872cb03"'::jsonb
-- )
-- WHERE name = 'Cooke Chile Assistant';
