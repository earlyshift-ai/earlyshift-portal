# 🚀 Setup Rápido - ACK Pattern Implementado

## ✅ Ya Completado:
- ✅ Migración de DB aplicada con `supabase db push`
- ✅ APIs creadas (/api/chat-async, /api/status)
- ✅ Hook useAsyncMessage con Realtime + polling
- ✅ UI AsyncChatInterface lista

## 🔧 Solo Falta:

### 1. Agregar variable de entorno
En tu `.env.local`, agrega:

```bash
# El webhook URL que ya tienes en Supabase
N8N_WEBHOOK_URL=https://blusolutions.app.n8n.cloud/webhook-test/59ea52a7-cd19-4c8a-a432-3dd0b872cb03
```

### 2. Configurar el bot en Supabase
Actualiza el webhook URL del bot para usar el nuevo endpoint ACK:

```sql
UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{webhook_url}',
  '"https://blusolutions.app.n8n.cloud/webhook/chat-async"'::jsonb
)
WHERE name = 'Cooke Chile Assistant';
```

### 3. Actualizar n8n workflow
En tu n8n existente, cambiar el webhook para:

1. **Recibir**: `{ sessionId, messageId, userId, text }`
2. **Responder inmediato**: `{ requestId: generatedId, status: 'queued' }`
3. **Background**: Procesar y actualizar Supabase

**Estructura esperada por el frontend:**
```javascript
// Input esperado por n8n:
{
  sessionId: "session-123",
  messageId: "msg-456", 
  userId: "user-789",
  text: "¿Cuál es el FCR?"
}

// Respuesta ACK inmediata:
{
  requestId: "generated-unique-id",
  status: "queued"
}
```

## 🎯 Flujo Completo:
1. Usuario envía mensaje → Aparece inmediatamente
2. Portal → n8n → ACK < 1s
3. UI: "🤖 Analizando..."
4. n8n procesa → Actualiza Supabase
5. Realtime → Respuesta aparece automáticamente

**¡No más 524 errors!** 🎉
