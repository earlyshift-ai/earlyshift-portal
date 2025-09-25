# Self-Hosted n8n Solution for Long-Running Queries

## The Problem
n8n.cloud uses Cloudflare which has ~100 second timeout limits for webhooks.

## Solution: Self-Host n8n

### Option A: Docker on Your Server
```bash
# Quick n8n setup with Docker
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Option B: Railway/Render/DigitalOcean
Deploy n8n on platforms without aggressive timeouts:
- **Railway**: Easy deployment, longer timeouts
- **Render**: Good for n8n hosting
- **DigitalOcean App Platform**: Flexible timeout settings

### Benefits
- ✅ **No Cloudflare timeouts**
- ✅ **Full control over timeout settings**
- ✅ **Can handle 5+ minute queries**
- ✅ **Custom domain support**

### Update Portal Configuration
```sql
-- Update webhook URL to your self-hosted n8n
UPDATE public.bots 
SET model_config = jsonb_set(
  model_config,
  '{webhook_url}',
  '"https://your-n8n-instance.com/webhook/your-webhook-id"'::jsonb
)
WHERE name = 'Cooke Chile Assistant';
```
