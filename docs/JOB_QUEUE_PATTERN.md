# Job Queue Pattern for Long-Running AI Queries

## How It Works

### Step 1: Quick Response
n8n responds immediately with:
```json
{
  "response": "🔄 Analizando tu consulta compleja sobre FCR y calidad. Te notificaré cuando esté listo...",
  "job_id": "query-12345",
  "status": "processing"
}
```

### Step 2: Background Processing
n8n continues processing the complex query in the background.

### Step 3: Result Delivery
When ready, n8n calls back to your portal:
```
POST https://portal.earlyshift.ai/api/webhook/result
{
  "job_id": "query-12345",
  "result": "Aquí está tu análisis completo..."
}
```

### Step 4: User Notification
Portal updates the chat with the final result.

## Implementation

### In n8n Workflow:
1. **Immediate Response** (< 30 seconds)
2. **Queue complex processing** 
3. **Callback with results** when ready

### In Portal:
1. **Show "processing" message**
2. **Accept callback webhook**
3. **Update chat interface** with final result

## Benefits
- ✅ **Works with n8n.cloud**
- ✅ **No timeout issues**
- ✅ **Better user experience**
- ✅ **Handles unlimited processing time**
