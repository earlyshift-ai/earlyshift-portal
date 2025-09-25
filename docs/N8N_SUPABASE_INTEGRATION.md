# n8n + Supabase Realtime Integration

## Overview
This integration stores messages directly in Supabase and uses Realtime for instant UI updates. No more caching or polling needed!

## n8n Workflow Setup

### 1. Webhook Trigger
- **Method**: POST
- **Response Mode**: "Respond to Webhook"

### 2. Set Context Node
Extract variables from the incoming payload:
```javascript
// Set these as separate output items
const sessionId = $json.session_id || $json.conversation_id;
const requestId = $json.request_id;
const assistantMessageId = $json.assistant_message_id;
const userId = $json.user_id;
const botId = $json.bot_id;
const botName = $json.bot_name;
const userMessage = $json.message;

return {
  sessionId,
  requestId,
  assistantMessageId,
  userId,
  botId,
  botName,
  userMessage
};
```

### 3. Respond to Webhook (Immediate ACK)
**Response Body:**
```json
{
  "requestId": "{{ $json.requestId }}",
  "status": "queued",
  "message": "Processing started"
}
```

### 4. Process with AI/LLM
Do your AI processing here (LangChain, OpenAI, etc.)

### 5. Update Message in Supabase
**HTTP Request Node:**
- **Method**: PATCH
- **URL**: `{{ $env.SUPABASE_URL }}/rest/v1/messages?id=eq.{{ $json.assistantMessageId }}`
- **Headers**:
  ```
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE }}
  apikey: {{ $env.SUPABASE_SERVICE_ROLE }}
  Content-Type: application/json
  Prefer: return=representation
  ```
- **Body**:
  ```json
  {
    "content": "{{ $json.finalResponse }}",
    "status": "completed",
    "latency_ms": "{{ $now - $json.startTime }}",
    "metadata": {
      "processing": false,
      "completed_at": "{{ $now }}",
      "model_used": "gpt-4",
      "tokens_used": 150
    }
  }
  ```

## Expected Payload Structure

Your Next.js app will send this to n8n:

```json
{
  "message": "User's question here",
  "conversation_history": [],
  "conversation_id": "session-uuid",
  "session_id": "session-uuid",
  "bot_id": "bot-uuid",
  "bot_name": "Assistant Name",
  "user_id": "user-uuid",
  "request_id": "timestamp-uuid",
  "assistant_message_id": "message-uuid-to-update"
}
```

## Environment Variables

Set these in your n8n environment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key
```

## How It Works

1. **User sends message** → Next.js creates user + assistant placeholder in Supabase
2. **Immediate ACK** → User sees message + "Processing..." placeholder
3. **n8n processes** → AI/LLM generates response  
4. **n8n updates** → PATCH the assistant message with final response
5. **Realtime triggers** → UI instantly updates with final response

## Benefits

✅ **No timeouts** - ACK pattern prevents 524 errors  
✅ **Real-time UI** - Instant updates via Supabase Realtime  
✅ **Message persistence** - All messages stored in database  
✅ **Session continuity** - Messages linked to sessions  
✅ **Conversation history** - Previous messages available for context  

## Troubleshooting

**Issue**: Messages not updating in UI
**Solution**: Check Realtime subscription is active and filtering by `session_id`

**Issue**: n8n can't update message  
**Solution**: Verify `SUPABASE_SERVICE_ROLE` key has correct permissions

**Issue**: Duplicate messages appearing
**Solution**: Ensure UI logic handles INSERT/UPDATE events correctly
