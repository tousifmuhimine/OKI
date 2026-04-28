# Midhat Progress Notes

This file records what has already been completed in the OKI CRM clone.

## Project Foundation

- Frontend is built with Next.js, React, Tailwind, lucide icons, and Supabase Auth.
- Backend is built with FastAPI, SQLAlchemy, Alembic, and Supabase Postgres/JWT auth.
- API base path is `/api/v1`.
- Docker support was added for backend plus Redis.
- Backend CORS now supports local Next dev origins including:
  - `localhost`
  - `127.0.0.1`
  - private LAN / WSL-style origins like `172.26.0.1`
- Backend auth was improved:
  - Local Supabase JWT verification.
  - Fallback verification through Supabase `/auth/v1/user`.
  - Frontend clears stale sessions and redirects to login on `401`.

## Authentication

- Supabase email/password login page exists at `/auth/login`.
- Signup page exists at `/auth/signup`.
- Forgot password page exists at `/auth/forgot-password`.
- Legacy `/login` redirects to `/auth/login`.
- Dashboard routes are protected by frontend middleware and `ProtectedPage`.
- Demo login support exists with browser session helpers.

## Core CRM Pages

- Dashboard page exists.
- Customers page exists.
- Leads page exists.
- Orders page exists.
- App shell / sidebar navigation exists.
- Settings navigation points to channel settings.

## Communication Hub Foundation

- Inbox-style data model was added:
  - `inboxes`
  - `contacts`
  - `conversations`
  - `messages`
- Alembic migration exists for inbox tables and enums.
- Backend models exist for inbox, contact, conversation, and message.
- Backend schemas exist for channel, integration, contact, conversation, message, and webhook payloads.
- Credentials in `channel_config` are encrypted before storage.

## Backend Inbox Routes

- `GET /api/v1/inbox/conversations`
- `GET /api/v1/inbox/conversations/{id}`
- `GET /api/v1/inbox/conversations/{id}/messages`
- `POST /api/v1/inbox/conversations/{id}/messages`
- `GET /api/v1/inbox/contacts`
- `POST /api/v1/inbox/contacts`
- `POST /api/v1/inbox/email/messages` for composing a new email thread.

## Backend Integration Routes

- `GET /api/v1/integrations`
- `POST /api/v1/integrations`
- `DELETE /api/v1/integrations/{id}`
- `POST /api/v1/integrations/email/sync`

## Channel Adapter Files

- Email adapter exists.
- Facebook adapter exists.
- Instagram adapter exists.
- WhatsApp adapter exists.
- Website/API placeholder adapter exists.
- Main channel dispatcher chooses the adapter based on `conversation.channel_type`.

## Mail Integration

Mail is already integrated as a separate workspace, not mixed into Talk.

- Sidebar `Mail` opens `/dashboard/mail`.
- `/dashboard/mail` is a dedicated mail page.
- Mail page supports:
  - email-only thread list
  - reading email messages
  - manual IMAP sync
  - replying to an email thread
  - composing a new email
  - selecting connected email inbox
  - setup instructions
- Email send uses SMTP.
- Email sync uses IMAP.
- Email compose supports subject.
- Email replies preserve a `Re:` subject.
- Mail setup is handled through `/dashboard/settings/channels`.

## Talk / Unified Inbox UI

- `/dashboard/inbox` exists as the Talk-style conversation hub.
- It supports:
  - conversation list
  - status tabs
  - channel filter
  - conversation search
  - message thread
  - reply box
  - manual email sync button
- Mail has been moved out of the sidebar's Talk click path and into its own dedicated Mail page.

## Channel Settings UI

- `/dashboard/settings/channels` exists.
- It can list connected channels.
- It can add channels for:
  - Facebook
  - Instagram
  - WhatsApp
  - Email
- Email channel setup includes provider presets:
  - Gmail / Google Workspace
  - Outlook / Microsoft 365
  - Custom mailbox
- Email setup collects SMTP and IMAP configuration.
- Connected email channels can be manually synced.

## Webhooks

- Facebook webhook verification route exists.
- Placeholder webhook receivers exist for:
  - Facebook
  - WhatsApp
  - Email
- These currently acknowledge payloads but do not fully ingest provider messages yet.

## Documentation

- `CHATWOOT_NEXT_STEPS.md` exists for larger remaining Chatwoot-style features.
- This `midhat.md` file records completed work.
- `midhat_instruct.md` records the immediate work that should happen before starting the larger Chatwoot next-steps list.
