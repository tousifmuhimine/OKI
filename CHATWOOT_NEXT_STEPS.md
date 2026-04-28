# Chatwoot-Style Communication Hub Next Steps

This hub is partially implemented. The project has the core inbox data model, backend routes, channel settings UI, and the `/dashboard/inbox` screen, but it is not yet a full Chatwoot-equivalent communication system.

## Already Implemented

- Docker compose exists for the backend plus Redis.
- Inbox database tables exist through Alembic:
  - `inboxes`
  - `contacts`
  - `conversations`
  - `messages`
- Backend inbox routes exist:
  - `GET /api/v1/inbox/conversations`
  - `GET /api/v1/inbox/conversations/{id}`
  - `GET /api/v1/inbox/conversations/{id}/messages`
  - `POST /api/v1/inbox/conversations/{id}/messages`
  - `GET /api/v1/inbox/contacts`
  - `POST /api/v1/inbox/contacts`
- Backend integration routes exist:
  - `GET /api/v1/integrations`
  - `POST /api/v1/integrations`
  - `DELETE /api/v1/integrations/{id}`
  - `POST /api/v1/integrations/email/sync`
- Channel adapter files exist for email, Facebook, Instagram, WhatsApp, and website/API-style channels.
- Email has SMTP send support and IMAP sync support.
- Channel credentials are encrypted before storage in `channel_config`.
- Frontend pages exist:
  - `/dashboard/inbox`
  - `/dashboard/mail`
  - `/dashboard/settings/channels`
- Mail is now its own workspace:
  - Read email-only threads.
  - Sync email through the connected IMAP mailbox.
  - Reply from the selected email thread.
  - Compose a new email through the connected SMTP mailbox.
- Auth pages and dashboard protection exist:
  - `/auth/login`
  - `/auth/signup`
  - `/auth/forgot-password`
  - `frontend/middleware.ts`

## Not Fully Implemented Yet

- Facebook webhook payloads are acknowledged, but not parsed into contacts, conversations, and incoming messages.
- Instagram webhook payloads are not separately handled beyond the Facebook webhook placeholder.
- WhatsApp webhook payloads are acknowledged, but not parsed into contacts, conversations, and incoming messages.
- Email inbound webhook route is only an acknowledgement placeholder. Current working inbound email path is IMAP sync.
- There is no background job worker yet for scheduled email sync, webhook processing, retries, or provider rate-limit handling.
- There is no realtime inbox update layer yet, so new messages require refresh or manual sync.
- Conversation status management is incomplete in the UI. The backend can store `open`, `resolved`, and `pending`, but there is no route/UI action to change status.
- Email is still conversation-based under the hood, similar to Chatwoot's free/open-source model, but the OKI UI now exposes it as a separate Mail page instead of mixing it into Talk.
- Attachments, message delivery status, read status, assignee/team assignment, labels, private notes, canned replies, and SLA features are not implemented.
- Website live chat is only a send placeholder, not a websocket/customer widget implementation.
- There are no automated tests yet covering the inbox routes, channel adapters, or frontend inbox flows.

## Recommended Next Steps

1. Implement webhook ingestion for Meta channels.
   - Parse Facebook, Instagram, and WhatsApp webhook payloads.
   - Upsert contacts by provider ID or phone number.
   - Upsert conversations per inbox/contact pair.
   - Insert incoming messages with provider metadata.

2. Add outbound provider hardening.
   - Store provider message IDs.
   - Capture send failures consistently.
   - Add delivery/read webhook handling where each provider supports it.

3. Add conversation workflow routes.
   - `PATCH /api/v1/inbox/conversations/{id}` for status changes.
   - Optional assignee, priority, labels, and internal note support.

4. Add background processing.
   - Use Redis-backed jobs for scheduled email sync and webhook processing.
   - Add retry behavior for temporary provider failures.

5. Add realtime updates.
   - Use websocket or Supabase realtime so `/dashboard/inbox` updates when new messages arrive.

6. Complete the website channel.
   - Add a customer-facing chat widget.
   - Add websocket session handling.
   - Store visitor identity in `contacts.channel_identifiers`.

7. Add tests.
   - Backend route tests for inbox, integrations, and webhooks.
   - Channel adapter tests with mocked providers.
   - Frontend smoke tests for inbox filtering, sending, and channel settings.

8. Polish frontend workflows.
   - Add status controls in the conversation header.
   - Add empty states that link to channel setup.
   - Add per-channel connection health and sync status.
