# Fix Webhook Configuration

## Problem
The chat interface is failing with a "Webhook failed: 404 Not Found" error because the webhook URL in the database is still set to a placeholder.

## Current Configuration
The Cooke Chile Assistant bot has this webhook URL:
```
https://your-webhook-endpoint.com/api/chat/cooke
```

## Steps to Fix

### 1. Get Your n8n Webhook URL
In your n8n workflow:
1. Go to your AI agent workflow
2. Find the webhook trigger node
3. Copy the webhook URL (it should look like: `https://your-n8n-instance.com/webhook/your-webhook-id`)

### 2. Update the Database
Replace `YOUR_ACTUAL_N8N_WEBHOOK_URL` with your real webhook URL and run this SQL:

```sql
-- Update webhook URL for Cooke Chile Assistant
UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{webhook_url}',
  '"YOUR_ACTUAL_N8N_WEBHOOK_URL"'::jsonb
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
```

### 3. Expected Webhook Payload
Your n8n webhook will receive this payload when users send messages:

```json
{
  "messages": [
    {
      "role": "user",
      "content": "User's message here"
    }
  ],
  "botId": "30000000-0000-0000-0000-000000000001",
  "tenantId": "20000000-0000-0000-0000-000000000001",
  "sessionId": "session-uuid-here",
  "user": {
    "id": "user-uuid",
    "email": "andres@earlyshift.ai"
  }
}
```

### 4. Expected Response Format
Your n8n workflow should respond with:

```json
{
  "response": "AI assistant response here",
  "message": "Alternative response field"
}
```

OR for streaming (if you want to implement it later):

```json
{
  "stream_url": "https://your-streaming-endpoint.com/stream/session-id",
  "supports_streaming": true
}
```

### 5. Test the Fix
After updating the webhook URL:
1. Refresh the portal
2. Send a test message to the Cooke Assistant
3. Check that it connects to your n8n workflow successfully

## Alternative: Test with Mock Response

If you want to test without n8n first, I can create a mock webhook endpoint in the portal itself.
