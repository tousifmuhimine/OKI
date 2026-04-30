# Facebook Messenger Integration for Oki CRM

## Overview
Added Facebook Messenger webhook integration to receive incoming messages directly into the CRM dashboard. Messages from Facebook pages now appear in real-time conversations in the inbox.

## Architecture

### Components
- **Frontend**: Next.js dashboard at `http://localhost:3000`
- **Backend**: FastAPI at `http://127.0.0.1:8000`
- **Database**: Supabase PostgreSQL
- **Tunnel**: ngrok for local webhook testing
- **Meta Integration**: Facebook Graph API v19.0

### Data Flow
```
Meta Messenger → ngrok tunnel → Backend Webhook 
→ Parse Payload → Find/Create Inbox 
→ Find/Create Contact → Find/Create Conversation 
→ Store Message → Dashboard Display
```

## Setup Steps

### 1. Meta App Configuration
- Created app in [Meta Developers](https://developers.meta.com/)
- Generated app credentials:
  - App ID: `XXXXXXXXXXXX`
  - App Secret: `XXXXXXXXXXXXXXXXXXXX`
- Connected Facebook Page and generated page access token

### 2. Backend Webhook Setup
**File**: `backend/app/inbox/routers/channels.py`

- Implemented POST endpoint: `/api/v1/inbox/webhooks/facebook`
- Endpoint accepts Meta webhook payloads and parses messaging events
- GET endpoint for webhook verification using verify token

**Verify Token**: Set in `.env` as `META_WEBHOOK_VERIFY_TOKEN=mytoken123`

### 3. ngrok Tunnel Configuration
**For Local Testing:**
```bash
ngrok http 8000
# Output: https://step-barn-exposure.ngrok-free.dev
```

This exposes local backend to internet so Meta can send webhooks.

### 4. Meta Webhook Configuration
In Meta App Dashboard → Messenger Platform → Settings:
- **Callback URL**: `https://step-barn-exposure.ngrok-free.dev/api/v1/inbox/webhooks/facebook`
- **Verify Token**: `mytoken123`
- **Subscribed Events**: 
  - `messages`
  - `messaging_postbacks`
  - `messaging_optins`

### 5. Database Tables
```
inboxes (channel_type='facebook', encrypted channel_config with page_id & token)
  ↓
conversations (links inbox → contact → workspace)
  ↓
messages (stores incoming/outgoing messages)
  ↓
contacts (channel_identifiers with facebook_id)
```

### 6. CRM Channel Creation
In CRM Dashboard → Settings → Channels:
1. Click "Add Channel"
2. Select "Facebook"
3. Enter:
   - **Name**: "Messenger"
   - **Page ID**: `1047346765137309`
   - **Page Access Token**: `EAA...XXXX`
   - **Integration Mode**: `live`

## Issues Encountered & Solutions

### Issue 1: Delete Endpoint Failing ("Failed to Fetch")
**Root Cause**: Incorrect SQLAlchemy async syntax
- Old code: `await session.delete(inbox)` ❌
- Fixed to: `await session.execute(delete(Inbox).where(...))` ✅

**File Changed**: `backend/app/inbox/routers/integrations.py`

### Issue 2: Delete Not Cascading
**Root Cause**: Missing `ON DELETE CASCADE` constraints on foreign keys
- `conversations.inbox_id` had no cascade delete
- `conversations.contact_id` had no cascade delete

**Solution Applied**:
```sql
ALTER TABLE conversations 
DROP CONSTRAINT conversations_inbox_id_fkey;

ALTER TABLE conversations 
ADD CONSTRAINT conversations_inbox_id_fkey 
FOREIGN KEY (inbox_id) REFERENCES inboxes(id) ON DELETE CASCADE;

ALTER TABLE conversations 
DROP CONSTRAINT conversations_contact_id_fkey;

ALTER TABLE conversations 
ADD CONSTRAINT conversations_contact_id_fkey 
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
```

**Files Changed**: `backend/app/db/models.py`

### Issue 3: Messages Not Showing in UI
**Root Cause**: ngrok not receiving Meta webhook events

**Investigation Steps**:
1. ✅ Backend webhook code verified working (tested with manual POST)
2. ✅ Database storage confirmed (test messages stored successfully)
3. ❌ ngrok inspect showed zero incoming requests
4. Solution: User needed to update Meta webhook configuration with correct callback URL and verify token

## Final Working Solution

### Backend Implementation

**Webhook Endpoint** (`backend/app/inbox/routers/channels.py`):
```python
@router.post("/webhooks/facebook", response_model=WebhookAck)
async def receive_facebook_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session_dep),
) -> WebhookAck:
    payload = await _json_payload(request)
    result = await _ingest_messaging_payload(session, "facebook", "page_id", payload)
    await session.commit()
    return WebhookAck(received=True, processed=result.get('processed', 0))
```

**Key Functions**:
- `_iter_messaging_events()` - Extracts sender/message from Facebook payload
- `_resolve_inbox()` - Finds inbox by matching encrypted page_id
- `_find_or_create_contact()` - Creates contact with facebook_id identifier
- `_find_or_create_conversation()` - Links inbox+contact+workspace
- `_store_message()` - Deduplicates and stores message in database

### Message Flow
```
1. Meta sends: {"object":"page","entry":[{"id":"PAGE_ID","messaging":[...]}]}
2. Extract recipient.id (PAGE_ID) and sender.id (SENDER_ID)
3. Query inboxes by channel_type='facebook', decrypt config, match page_id
4. Create Contact with channel_identifiers["facebook"] = SENDER_ID
5. Create Conversation(inbox_id, contact_id, workspace_id)
6. Store Message(content, sender_id, message_metadata with raw_event)
7. Frontend queries messages, displays in conversation
```

## Testing

### Manual Webhook Test
```powershell
$body = @{
    object = "page"
    entry = @(@{
        id = "1047346765137309"
        messaging = @(@{
            sender = @{ id = "123456789" }
            recipient = @{ id = "1047346765137309" }
            message = @{ mid = "mid.1"; text = "Hello test!" }
        })
    })
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri 'http://127.0.0.1:8000/api/v1/inbox/webhooks/facebook' `
    -Method POST -ContentType 'application/json' -Body $body
```

### Live Test
1. Send message to Facebook Page via Messenger
2. Check ngrok dashboard for incoming request
3. Verify message appears in CRM dashboard within 2-3 seconds

## Production Deployment

### Option 1: Keep ngrok (Not Recommended)
- Free tier URL changes on restart
- Requires reconfiguring Meta webhooks each time
- Slow for production traffic

### Option 2: ngrok Pro ($10/month)
- Reserve permanent domain: `https://yourdomain.ngrok.io`
- URL never changes
- Good for ongoing development

### Option 3: Deploy to Production (Recommended)
1. Deploy backend to server (AWS, Heroku, DigitalOcean, etc.)
2. Use permanent domain (e.g., `api.company.com`)
3. Configure SSL certificate
4. Update Meta webhooks to production domain
5. No ngrok needed

## Environment Variables

**Backend** (`.env`):
```
META_WEBHOOK_VERIFY_TOKEN=mytoken123
ALLOW_ANON_DEV=true
DEBUG=true
SUPABASE_URL=https://tfbuarufxuwvfhmkbeaz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_SUPABASE_URL=https://tfbuarufxuwvfhmkbeaz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
```

## Files Modified

### Backend
- `backend/app/inbox/routers/channels.py` - Webhook handlers (240+ lines)
- `backend/app/inbox/routers/integrations.py` - Delete endpoint fix (async SQLAlchemy)
- `backend/app/db/models.py` - Added CASCADE constraints to Conversation model

### Frontend
- No changes needed (already had channel management UI)

## Current Status

✅ **Working Features**:
- Webhook verification with Meta
- Message ingestion from Facebook Messenger
- Real-time message storage in database
- Messages display in CRM dashboard
- Delete/reconfigure inbox channels
- Support for multiple Facebook pages

🚧 **Ready for Implementation**:
- Instagram Messaging (same webhook structure)
- WhatsApp Cloud API (different payload structure)
- Email integration (separate webhook handler)

## Related Docs
- [Meta Messenger API](https://developers.facebook.com/docs/messenger-platform)
- [ngrok Documentation](https://ngrok.com/docs)
- [FastAPI WebhookS](https://fastapi.tiangolo.com/)
- [SQLAlchemy Async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)

## Troubleshooting

**Messages not appearing?**
1. Check ngrok is running: `ngrok http 8000`
2. Verify callback URL in Meta dashboard matches ngrok URL
3. Check backend logs for errors
4. Send test message: `python test_webhook.py`
5. Query database: `python check_delete_result.py`

**Delete channel fails?**
- Check foreign key constraints are in place
- Verify user has permission (workspace_id matches)
- Backend must be running with fix applied

**ngrok URL changed?**
- Update Meta dashboard callback URL
- Restart backend if needed
- No frontend changes required
