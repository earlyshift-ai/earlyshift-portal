# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `pnpm dev` - Start development server with Turbopack (default port 3000)
- `pnpm build` - Build production application with Turbopack
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint

### Package Management
This project uses pnpm. Install dependencies with `pnpm install`.

## Architecture Overview

### Multi-Tenant Chat Portal with AI Integration
This is a Next.js 15.5.4 application using App Router that provides a multi-tenant chat interface connecting to AI agents via webhooks (primarily n8n workflows) and standard LLMs.

### Key Technologies
- **Frontend**: Next.js 15.5.4 with React 19.1.0, TypeScript, Tailwind CSS v4
- **UI Components**: shadcn/ui components with Radix UI primitives
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **AI Integration**: Vercel AI SDK with OpenAI, custom webhook integration for n8n
- **Styling**: Tailwind CSS with CSS variables, shadcn/ui theming

### Core Architecture Patterns

#### 1. Multi-Tenant System
- Tenants are isolated at database level using RLS policies
- Each tenant has custom branding (colors, logos) stored in `tenants` table
- Users access via tenant-specific subdomains (e.g., `cooke.earlyshift.ai`)
- Tenant context provided via `TenantProvider` component

#### 2. Authentication & Middleware
- Supabase Auth with SSR support via middleware (`src/middleware.ts`)
- Protected routes handled via middleware pattern
- Session management in `@/lib/supabase/middleware.ts`

#### 3. Chat System Architecture
The chat system supports two bot types:
- **Webhook Bots**: Connect to n8n workflows via HTTP webhooks
- **LLM Bots**: Direct integration with OpenAI/other providers via AI SDK

Key components:
- `SessionManagedChat` - Main chat component with session and message management
- `AsyncChatInterface` - Handles async messaging with polling/realtime updates
- Message flow: Client → API Route → Webhook/LLM → Response → Database → Client

#### 4. API Routes Structure
- `/api/chat` - Standard synchronous chat endpoint
- `/api/chat-async` - Asynchronous chat with ACK pattern
- `/api/chat-async-supabase` - Direct Supabase integration for async
- `/api/webhook/mock` - Mock webhook for testing
- `/api/session` - Session management endpoints

#### 5. Database Schema
Key tables:
- `tenants` - Multi-tenant configuration and branding
- `bots` - Bot configurations with `model_config` JSONB
- `bot_access` - Tenant-bot access control with usage limits
- `messages` - Chat messages with async status tracking
- `chat_sessions` - User chat sessions

#### 6. n8n Integration Pattern
Webhook payload structure:
```json
{
  "message": "user message",
  "conversation_history": [...],
  "bot_info": {...},
  "timestamp": "ISO 8601"
}
```

Bot configuration in `model_config`:
```json
{
  "model": "webhook",
  "webhook_url": "https://n8n-instance/webhook/...",
  "timeout": 600000,
  "supports_streaming": false
}
```

## Important Implementation Details

### Session Management
The system uses a unique session ID pattern for chat conversations. Sessions are created per bot/user combination and messages are tracked via `request_id` for async operations.

### Async Message Flow
1. User sends message → API returns ACK with `request_id`
2. n8n processes message asynchronously
3. n8n updates message status in database
4. Client polls or uses realtime subscription for updates

### Error Handling
- Webhook timeouts default to 10 minutes (configurable per bot)
- Graceful fallbacks for webhook failures
- User-friendly error messages for timeout scenarios

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## File Naming Conventions
- React components: PascalCase (e.g., `ChatInterface.tsx`)
- Utilities/hooks: kebab-case (e.g., `use-session-id.ts`)
- API routes: kebab-case directories with `route.ts`

## Path Aliases
- `@/` maps to `./src/`
- Common imports: `@/components`, `@/lib`, `@/hooks`