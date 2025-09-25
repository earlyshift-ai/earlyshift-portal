# Multi-Tenant Chat Interface Setup

## Overview

We've successfully integrated a Chat SDK-inspired interface into our multi-tenant portal that connects to n8n AI agents via webhooks. The system supports both webhook-powered bots (n8n agents) and standard LLM bots.

## Features Implemented

### ✅ Chat Interface Components
- **`ChatInterface`** - Main chat component with bot selection and message handling
- **`MessageList`** - Displays conversation with markdown support and syntax highlighting
- **`BotSelector`** - Dropdown for selecting available bots per tenant
- **Multi-tenant branding** - Dynamic theming based on tenant colors and logos

### ✅ Backend Integration
- **Webhook API** (`/api/chat/route.ts`) - Handles both n8n webhook calls and standard LLM requests
- **Database integration** - Saves messages and sessions to Supabase
- **Tenant isolation** - Ensures users only access their tenant's bots
- **Real-time messaging** - Built on AI SDK for streaming responses

### ✅ n8n Webhook Support
- **Custom webhook calls** to n8n workflows
- **Conversation history** passed to n8n for context
- **Streaming support** for real-time responses
- **Error handling** with graceful fallbacks
- **Timeout management** (30s default)

## Configuration

### Bot Configuration

Each bot in the `bots` table has a `model_config` JSON field:

```json
{
  "model": "webhook",
  "webhook_url": "https://your-n8n-instance.com/webhook/your-workflow",
  "webhook_method": "POST",
  "webhook_headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer your-token"
  },
  "timeout": 30000,
  "supports_streaming": true
}
```

### n8n Webhook Payload

Your n8n workflow will receive:

```json
{
  "message": "User's current message",
  "conversation_history": [
    {
      "role": "user|assistant",
      "content": "Message content",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "bot_info": {
    "id": "bot-uuid",
    "name": "Bot Name",
    "system_prompt": "Bot's system prompt"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### n8n Response Format

Your n8n workflow should return:

```json
{
  "response": "Bot's response message",
  "metadata": {
    "processing_time": 1500,
    "confidence": 0.95
  }
}
```

## Usage

### Dashboard Access

1. User logs in at `portal.earlyshift.ai/login`
2. Gets redirected to tenant subdomain: `cooke.earlyshift.ai/dashboard`
3. Dashboard shows available bots and chat interface

### Chat Flow

1. **Bot Selection** - User selects from available bots (dropdown)
2. **Session Creation** - New chat session created automatically
3. **Message Sending** - User types message and sends
4. **Webhook Call** - If webhook bot, calls n8n endpoint
5. **Response Handling** - Displays response with markdown support
6. **Message Storage** - Saves conversation to database

### Example Mock Data

We've created **Cooke Chile** with:
- **Tenant**: `cooke` slug, blue branding (#2563EB)
- **User**: `andres@earlyshift.ai` as owner
- **Bot**: "Cooke Chile Assistant" - Aquaculture specialist
- **Access**: 200 daily / 5000 monthly message limits

## Testing Your Setup

### 1. Verify Database Setup
Run in Supabase SQL Editor:
```sql
-- Check tenant setup
SELECT * FROM public.tenants WHERE slug = 'cooke';

-- Check bot configuration
SELECT name, model_config FROM public.bots WHERE name LIKE '%Cooke%';

-- Check user access
SELECT * FROM public.get_user_memberships('user-uuid-here');
```

### 2. Test Webhook Endpoint

Create a simple n8n workflow:

1. **Webhook Trigger** - POST endpoint
2. **Set Node** - Extract message: `{{ $json.message }}`
3. **Function Node** - Process and return response:
   ```javascript
   return {
     response: `I received: "${items[0].json.message}". This is from Cooke Chile AI Agent!`,
     metadata: {
       processing_time: new Date().getTime() - new Date(items[0].json.timestamp).getTime()
     }
   };
   ```

### 3. Update Bot Configuration

Update the Cooke Chile bot webhook URL:
```sql
UPDATE public.bots 
SET model_config = model_config || '{"webhook_url": "YOUR_N8N_WEBHOOK_URL"}'::jsonb
WHERE name = 'Cooke Chile Assistant';
```

## Architecture Benefits

1. **Scalable** - Each tenant can have different bots with different configurations
2. **Flexible** - Supports both webhook (n8n) and LLM-based bots
3. **Secure** - Tenant isolation at database level
4. **Real-time** - Streaming responses for better UX
5. **Customizable** - Per-tenant branding and bot configurations

## Next Steps

1. **Set up your n8n instance** with webhook endpoints
2. **Configure webhook URLs** in bot configurations
3. **Test the complete flow** from login to chat response
4. **Add more bots** as needed for different use cases
5. **Implement advanced features** like file uploads, voice input, etc.

The foundation is solid and ready for your complex n8n AI agents! 🚀
