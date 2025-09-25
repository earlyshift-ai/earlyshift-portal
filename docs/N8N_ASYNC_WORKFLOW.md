# n8n Async Workflow Configuration

## Overview
This workflow implements the ACK + background processing pattern to avoid Cloudflare 524 timeouts.

## Workflow Structure

### 1. Webhook Trigger Node
- **Node Type**: Webhook
- **HTTP Method**: POST
- **Path**: `/webhook/chat` (or your custom path)
- **Response Mode**: Respond to Webhook

**Expected Body**:
```json
{
  "sessionId": "uuid",
  "messageId": "uuid", 
  "userId": "uuid",
  "text": "user message",
  "meta": {}
}
```

### 2. Set Node - "Create Context"
- **Node Type**: Set
- **Operation**: Manually set values

**Values to Set**:
```javascript
requestId: {{$now}}-{{$json.messageId || $random.uuid()}}
tsStart: {{$now}}
sessionId: {{$json.sessionId}}
userId: {{$json.userId}}
text: {{$json.text}}
```

### 3. HTTP Request - "Insert Queued Message"
- **Node Type**: HTTP Request
- **Method**: POST
- **URL**: `https://YOUR_PROJECT.supabase.co/rest/v1/messages`

**Headers**:
```
apikey: {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE_KEY }}
Content-Type: application/json
Prefer: return=representation
```

**Body** (Expression):
```javascript
{{
  {
    session_id: $json.sessionId,
    request_id: $json.requestId,
    role: 'user',
    content: $json.text,
    status: 'queued',
    created_at: new Date().toISOString()
  }
}}
```

### 4. Respond to Webhook - "Send ACK"
- **Node Type**: Respond to Webhook
- **Response Mode**: Respond With JSON
- **Status Code**: 202

**Response Body** (Expression):
```javascript
{{ { requestId: $json.requestId, status: 'queued' } }}
```

⚠️ **CRITICAL**: This node must complete quickly (< 10 seconds) to send the ACK.

### 5. Branch - Background Processing
From the Webhook trigger (NOT from Respond to Webhook), create a parallel branch:

#### 5a. Function Node - "Sanitize Input" (Optional)
```javascript
const text = $input.all()[0].json.text || '';
const sanitized = text.trim().slice(0, 4000); // Limit length
return { json: { text: sanitized } };
```

#### 5b. Your AI/LLM Processing Nodes
- Add your existing AI orchestrator/agent nodes here
- Process the `text` field
- Generate `finalText` as output

#### 5c. Function Node - "Calculate Metrics"
```javascript
const start = new Date($input.all()[0].json.tsStart).getTime();
const end = Date.now();
const latency_ms = end - start;

return { 
  json: { 
    finalText: $input.all()[0].json.finalText || $input.all()[0].json.response || 'No response generated',
    latency_ms,
    requestId: $input.all()[0].json.requestId
  } 
};
```

#### 5d. HTTP Request - "Update Completed"
- **Method**: PATCH
- **URL**: `https://YOUR_PROJECT.supabase.co/rest/v1/messages?request_id=eq.{{$json.requestId}}`

**Headers**: Same as step 3

**Body** (Expression):
```javascript
{{ 
  {
    status: 'completed',
    output_text: $json.finalText,
    latency_ms: $json.latency_ms,
    role: 'assistant',
    updated_at: new Date().toISOString()
  }
}}
```

### 6. Error Handling Branch
Connect error outputs from processing nodes to:

#### HTTP Request - "Update Failed"
- **Method**: PATCH  
- **URL**: `https://YOUR_PROJECT.supabase.co/rest/v1/messages?request_id=eq.{{$json.requestId}}`

**Body** (Expression):
```javascript
{{
  {
    status: 'failed',
    error_text: $json.error?.message || $input.all()[0].json.error?.message || 'Processing failed',
    updated_at: new Date().toISOString()
  }
}}
```

## Environment Variables Needed in n8n

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Testing the Workflow

### 1. Test ACK Response
```bash
curl -X POST https://your-n8n.com/webhook/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-123",
    "messageId": "msg-456", 
    "userId": "user-789",
    "text": "Hello test"
  }'
```

Expected response (within 10 seconds):
```json
{
  "requestId": "1703123456789-msg-456",
  "status": "queued"
}
```

### 2. Verify Database Update
Check Supabase messages table for:
- Initial row with `status: 'queued'`
- Updated row with `status: 'completed'` and `output_text`

### 3. Test Realtime Updates
Monitor Supabase Realtime logs to ensure UPDATE events are firing.

## Key Success Criteria

✅ **ACK within 10 seconds**: Respond to Webhook completes quickly
✅ **Background processing**: AI processing happens after ACK  
✅ **Database updates**: Status changes from queued → completed/failed
✅ **Realtime events**: Supabase fires UPDATE events for frontend
✅ **Error handling**: Failed requests update with error_text

## Common Issues

1. **Slow ACK**: Move heavy processing AFTER Respond to Webhook
2. **Missing updates**: Check Supabase RLS policies for service role access  
3. **JSON errors**: Use Expression syntax `{{ {...} }}` for object responses
4. **Environment vars**: Ensure SUPABASE_SERVICE_ROLE_KEY is set in n8n

## Workflow JSON Export

To import this workflow into n8n, use the JSON configuration file:
`n8n-async-chat-workflow.json` (create this file with your specific node IDs)
