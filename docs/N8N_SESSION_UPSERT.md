# n8n Session Upsert Configuration

## Overview
This document explains how to configure your n8n workflow to properly handle chat sessions to avoid foreign key constraint errors.

## Problem
The current setup sometimes fails with:
```
ERROR: insert or update on table "messages" violates foreign key constraint "messages_session_id_fkey"
```

This happens because the webhook tries to insert messages with a `session_id` that doesn't exist in the `chat_sessions` table.

## Solution: Session Upsert Before Message Insert

Add a **Session Upsert** node in your n8n workflow BEFORE inserting any messages.

### Step 1: Add HTTP Request Node for Session Upsert

**Position:** Right after your webhook trigger and context setup, but BEFORE any message inserts.

**Configuration:**
- **Name:** "Upsert Chat Session"
- **Method:** POST
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/chat_sessions`
- **Headers:**
  ```
  Authorization: Bearer {{ $env.SUPABASE_SERVICE_ROLE }}
  apikey: {{ $env.SUPABASE_SERVICE_ROLE }}
  Content-Type: application/json
  Prefer: resolution=merge-duplicates
  ```
- **Body (JSON):**
  ```json
  {
    "id": "{{ $json.session_id || $json.conversation_id }}",
    "user_id": "{{ $json.user_id || null }}",
    "bot_id": "{{ $json.bot_id || null }}",
    "updated_at": "{{ $now }}"
  }
  ```

### Step 2: Configure Environment Variables

Make sure these are set in your n8n environment:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE=your-service-role-key-here
```

**Important:** Use the `service_role` key, NOT the `anon` key, as it has permissions to bypass RLS.

### Step 3: Update Your Workflow Order

Your n8n workflow should follow this order:

1. **Webhook Trigger** (receives payload)
2. **Set Context** (extract variables)
3. **🆕 Upsert Chat Session** (ensures session exists)
4. **Insert User Message** (with status: 'queued')
5. **ACK Response** (immediate 202 response)
6. **AI Processing** (LLM, tools, etc.)
7. **Update Message** (with final result)

### Step 4: Verify Session Payload

Your webhook should receive this enhanced payload structure:

```json
{
  "message": "user question here",
  "conversation_id": "uuid-session-id",
  "session_id": "uuid-session-id",
  "bot_id": "bot-uuid-or-string",
  "bot_name": "Assistant Name",
  "user_id": "user-uuid-or-null",
  "request_id": "unique-request-id"
}
```

### Example Complete Node Configuration

**HTTP Request - Upsert Chat Session**
```json
{
  "method": "POST",
  "url": "{{ $env.SUPABASE_URL }}/rest/v1/chat_sessions",
  "headers": {
    "Authorization": "Bearer {{ $env.SUPABASE_SERVICE_ROLE }}",
    "apikey": "{{ $env.SUPABASE_SERVICE_ROLE }}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
  },
  "body": {
    "id": "{{ $json.session_id }}",
    "user_id": "{{ $json.user_id }}",
    "bot_id": "{{ $json.bot_id }}",
    "updated_at": "{{ $now }}"
  }
}
```

## Testing

After implementing this, you can test by:

1. Sending a message from the dashboard
2. Checking the n8n execution log for the "Upsert Chat Session" step
3. Verifying no FK constraint errors occur
4. Confirming the session appears in your Supabase `chat_sessions` table

## Benefits

✅ **No more FK errors** - Sessions are guaranteed to exist  
✅ **Proper session tracking** - Each conversation has a stable ID  
✅ **Message history** - All messages are properly linked to sessions  
✅ **Realtime works** - UI can subscribe to session-specific updates  
✅ **"Nuevo Chat"** - Users can start fresh conversations  

## Troubleshooting

**Issue:** `resolution=merge-duplicates` header not working
**Solution:** Make sure you're using the latest Supabase API version and the `service_role` key.

**Issue:** Session upsert returns 403 Forbidden
**Solution:** Verify your `SUPABASE_SERVICE_ROLE` key is correct and has full permissions.

**Issue:** Still getting FK errors
**Solution:** Make sure the session upsert step comes BEFORE any message insert operations in your workflow.
