# n8n Response Configuration

## Current Issue
Your n8n workflow is working but returning this format:
```json
[{"output":"Your AI response here"}]
```

The portal expects this format:
```json
{"response": "Your AI response here"}
```

## Fix: Configure "Respond to Webhook" Node

### Step 1: Select Response Mode
In your "Respond to Webhook" node:
- **Response With**: Select "Using 'Respond to Webhook' Node"
- **Response Data**: JSON

### Step 2: Set Response Body
In the response body field, use this exact format:

**Option A: If you have a single AI response**
```json
{
  "response": "{{ $json.output }}"
}
```

**Option B: If you have an array of responses (current case)**
```json
{
  "response": "{{ $json[0].output }}"
}
```

**Option C: More robust (handles both cases)**
```json
{
  "response": "{{ Array.isArray($json) ? $json[0].output : $json.output }}"
}
```

### Step 3: Set Headers (Optional)
- **Content-Type**: `application/json`

### Step 4: Response Code
- Set to **200**

## Complete Setup

1. Click on your "Respond to Webhook" node
2. Set **Response With** to "Using 'Respond to Webhook' Node"
3. In the response body, paste:
```json
{
  "response": "{{ $json[0].output }}"
}
```
4. Set **Content-Type** to `application/json`
5. Save and make sure workflow is **Active**

## Alternative: Use a Set Node Before Response

If the above doesn't work, add a "Set" node before "Respond to Webhook":

**Set Node Configuration:**
- **Name**: format_response
- **Mode**: Manual
- **Fields to Set**:
  - **Name**: `response`
  - **Value**: `{{ $json[0].output }}`

Then in "Respond to Webhook":
- **Response With**: "Using 'Respond to Webhook' Node"  
- **Response Body**: `{{ $json }}`

This will ensure the portal gets exactly the format it expects!
