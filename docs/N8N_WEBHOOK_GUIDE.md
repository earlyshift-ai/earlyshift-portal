# n8n Webhook Integration Guide

## Webhook Configuration

### 1. Webhook Trigger Node Settings
- **HTTP Method**: `POST`
- **Path**: `/webhook-test/59ea52a7-cd19-4c8a-a432-3dd0b872cb03`
- **Authentication**: None (or configure if needed)
- **Response Mode**: `Respond to Webhook`
- **Response Code**: `200`

### 2. Payload Structure
Your n8n workflow will receive this payload:

```json
{
  "message": "User's chat message",
  "conversation_history": [
    {
      "role": "user", 
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ],
  "bot_info": {
    "id": "bot-uuid",
    "name": "Cooke Chile Assistant", 
    "system_prompt": "You are the Cooke Chile Assistant..."
  },
  "timestamp": "2025-09-24T22:35:00.000Z"
}
```

### 3. Required Response Format
Your workflow MUST respond with valid JSON in one of these formats:

**Option 1: Simple Response**
```json
{
  "response": "AI assistant response here"
}
```

**Option 2: Alternative Field Names**
```json
{
  "message": "AI assistant response here"
}
```

**Option 3: With Additional Metadata**
```json
{
  "response": "AI assistant response here",
  "confidence": 0.95,
  "processing_time": 1234,
  "sources": ["document1", "document2"]
}
```

### 4. Common Issues and Fixes

#### Empty Response
- **Problem**: Workflow returns empty body
- **Fix**: Ensure your workflow has a "Respond to Webhook" node with content

#### Invalid JSON
- **Problem**: Response is not valid JSON
- **Fix**: Use "Set" node to format response as JSON before webhook response

#### Timeout Errors
- **Problem**: Workflow takes longer than 60 seconds
- **Fix**: Optimize your AI processing or use streaming responses

### 5. Example n8n Workflow Structure

1. **Webhook Trigger** → Receives the chat payload
2. **Code/Function Node** → Extract message: `$json.message`
3. **AI Node** (OpenAI, Claude, etc.) → Process the message
4. **Set Node** → Format response: `{ "response": "{{$json.choices[0].message.content}}" }`
5. **Respond to Webhook** → Send formatted response back

### 6. Testing Your Webhook

After setting up your workflow:

1. Make sure workflow is **Active** (not just test mode)
2. Test with curl:
```bash
curl -X POST "https://blusolutions.app.n8n.cloud/webhook-test/59ea52a7-cd19-4c8a-a432-3dd0b872cb03" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, test message", "timestamp": "2025-09-24T22:35:00.000Z"}'
```

3. Should return valid JSON with your AI response

### 7. Current Portal Configuration

The portal is configured with:
- **Timeout**: 60 seconds
- **Method**: POST
- **Expected Response**: JSON with `response`, `message`, or `text` field
- **Error Handling**: Graceful fallback for empty/invalid responses

Make sure your n8n workflow responds within 60 seconds with valid JSON!
