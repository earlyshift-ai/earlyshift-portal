# Multi-Tenant Company Selection Flow

## Overview

The portal now supports multiple companies per user with an elegant selection interface. Users can belong to multiple tenants with different roles and are presented with a company selection popup when needed.

## Flow Implementation

### 1. **Authentication Flow**
```
User visits portal.earlyshift.ai
↓
Logs in via email/password
↓
Redirects to /select-company
↓
System checks user's memberships:
  - 0 memberships → "No Access" page
  - 1 membership → Auto-redirect to tenant dashboard
  - 2+ memberships → Show company selection modal
```

### 2. **Company Selection Modal**

**Features:**
- **Beautiful UI** - Cards showing company name, role, and subdomain
- **Role indicators** - Owner (Crown), Admin (Shield), Member (User)
- **Auto-redirect** - Single tenant users skip the selection
- **Error handling** - Graceful fallbacks for edge cases

**Role Display:**
- **Owner** 👑 - Yellow badge with crown icon
- **Admin** 🛡️ - Blue badge with shield icon  
- **Member** 👤 - Gray badge with user icon

### 3. **Redirect Logic**

**Development Mode:**
- Single tenant → `/dashboard` (local)
- Multiple tenants → User selects → `/dashboard` (local)
- Stores selected tenant in localStorage for dev testing

**Production Mode:**
- Single tenant → `https://{slug}.earlyshift.ai/dashboard`
- Multiple tenants → User selects → `https://{slug}.earlyshift.ai/dashboard`

## Components Created

### ✅ **TenantSelectorModal**
- Modal popup for company selection
- Displays company cards with branding
- Shows role badges and descriptions
- Handles loading states during redirect

### ✅ **TenantSelectorClient**
- Client-side wrapper for modal
- Handles auto-redirect logic
- Manages development vs production redirects
- Shows loading states

### ✅ **Badge Component**
- Reusable badge component for role display
- Multiple variants (default, secondary, destructive, outline)
- Consistent styling across the app

## Updated Pages

### ✅ **`/select-company`**
- Main tenant selection page
- Server-side membership fetching
- Error handling for edge cases
- Fallback for users without access

### ✅ **`/dashboard`**
- Updated to handle single tenant users
- Redirects multi-tenant users to selection
- Integrated with tenant branding system

### ✅ **`/` (Home)**
- Landing page for unauthenticated users
- Auto-redirects authenticated users to company selection
- Professional marketing copy with CTAs

### ✅ **Auth Flow Updates**
- `/auth/confirm` → redirects to `/select-company`
- `/protected` → redirects to `/select-company`
- Consistent flow throughout the app

## User Experience

### **Single Company User (Andres @ Cooke Chile)**
1. Logs in at `portal.earlyshift.ai/login`
2. Gets redirected to `/select-company`
3. System detects single membership
4. Auto-redirects to `cooke.earlyshift.ai/dashboard`
5. **Total time: ~2 seconds** ⚡

### **Multi-Company User (Future)**
1. Logs in at `portal.earlyshift.ai/login`
2. Gets redirected to `/select-company`
3. Sees beautiful company selection modal
4. Clicks preferred company card
5. Redirects to chosen tenant's dashboard

### **No Access User**
1. Logs in successfully
2. Gets redirected to `/select-company`
3. Sees "No Company Access" message
4. Contact admin instructions provided

## Security & Data Isolation

- **Server-side validation** - All membership checks happen server-side
- **RLS enforcement** - Database policies ensure tenant isolation
- **Role-based access** - Different permissions per tenant
- **Audit logging** - All tenant selections are logged

## Testing the Flow

### **Current Setup (Cooke Chile)**
```bash
# User: andres@earlyshift.ai
# Company: Cooke Chile (slug: "cooke")
# Role: Owner
# Expected: Auto-redirect to dashboard
```

### **Testing Multi-Tenant (Future)**
To test multi-tenant selection:
1. Add user to another tenant in database
2. User will see selection modal
3. Can choose between companies

## Development vs Production

**Development (`localhost:3000`):**
- Uses `/dashboard` route locally
- Stores tenant selection in localStorage
- Easier testing and debugging

**Production (`*.earlyshift.ai`):**
- Uses actual subdomain redirects
- Real multi-tenant experience
- Cross-domain session handling

## Next Steps

1. **Test with real users** - Verify flow works smoothly
2. **Add company branding** - Show logos in selection cards  
3. **Remember last choice** - Cache preferred company selection
4. **Admin management** - Interface to manage user memberships
5. **Bulk invitations** - Invite multiple users to tenants

The company selection flow is now complete and provides a professional, scalable foundation for multi-tenant user management! 🎉
