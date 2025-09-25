# Environment Variables Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# n8n Configuration for Async Chat
N8N_WEBHOOK_URL=https://your-n8n.com/webhook/chat
```

## Example Values

```bash
# Example (replace with your actual values)
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
N8N_WEBHOOK_URL=https://blusolutions.app.n8n.cloud/webhook/chat-async
```

## Setup Steps

1. **Apply Database Migration**:
   ```bash
   # In Supabase SQL Editor, run:
   # supabase/migrations/20250924220000_extend_messages_async.sql
   ```

2. **Configure n8n Workflow**:
   - Follow instructions in `docs/N8N_ASYNC_WORKFLOW.md`
   - Set `SUPABASE_SERVICE_ROLE_KEY` in n8n environment variables
   - Update webhook URL in your bot configuration

3. **Update Bot Configuration**:
   ```sql
   UPDATE public.bots 
   SET model_config = jsonb_set(
     model_config,
     '{webhook_url}',
     '"https://your-n8n.com/webhook/chat"'::jsonb
   )
   WHERE name = 'Cooke Chile Assistant';
   ```

4. **Test the Setup**:
   ```bash
   pnpm dev
   # Visit http://localhost:3000/dashboard
   # Send a test message
   # Should receive ACK immediately
   # Response should appear via Realtime
   ```

## Verification Checklist

- [ ] Database migration applied successfully
- [ ] n8n workflow returns ACK within 10 seconds  
- [ ] Messages table updates with status changes
- [ ] Realtime subscription receives updates
- [ ] Polling fallback works if Realtime fails
- [ ] Error handling works for failed requests
- [ ] UI shows loading state and final response
