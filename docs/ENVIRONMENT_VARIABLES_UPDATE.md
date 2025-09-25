# Environment Variables Update for Session Manager

## Required Environment Variables

Please add these to your `.env.local` file and your n8n environment:

### For Next.js (.env.local)
```bash
# Existing variables
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
N8N_WEBHOOK_URL=your-n8n-webhook-url

# New variable needed for session management
SUPABASE_SERVICE_ROLE=your-service-role-key-here
```

### For n8n Environment
```bash
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE=your-service-role-key-here
```

## Where to Find Your Service Role Key

1. Go to your Supabase project dashboard
2. Navigate to **Settings** → **API**
3. Under **Project API keys**, copy the **service_role** key (not the anon key)
4. This key has elevated permissions and can bypass RLS

## Why Service Role is Needed

The service role key is required for:
- Creating/updating chat sessions from n8n
- Bypassing Row Level Security for system operations
- Ensuring message insertions have valid session foreign keys

## Security Note

⚠️ **Important:** The service role key should ONLY be used:
- On the server side (never in client code)
- In trusted environments (n8n, API routes)
- For administrative operations

Never expose the service role key in client-side code or public repositories.
