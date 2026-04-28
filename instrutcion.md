This is the OKI CRM Clone project. Repo: https://github.com/tousifmuhimine/OKI

CURRENT STACK:
- Frontend: Next.js + Tailwind + Supabase Auth (/frontend)
- Backend: FastAPI + SQLAlchemy + Supabase Postgres/JWT (/backend)
- Auth: Working — Supabase email/password, backend validates JWT
- Existing API routes: Dashboard, Customers, Leads, Orders
- Backend: localhost:8000/api/v1
- Frontend: localhost:3000
- Docker: Not yet set up, needs to be added

---

## TASK: Build a Communication Hub (Inbox) inspired by Chatwoot

Take inspiration from Chatwoot's open source code 
(https://github.com/chatwoot/chatwoot) for logic, data models, 
and channel handling — but implement everything in OUR stack:
- Backend: Python FastAPI (not Ruby on Rails)
- Frontend: Next.js + Tailwind (not Vue.js)
- Database: Supabase PostgreSQL (not a separate DB)

Do NOT copy Chatwoot code directly. Use it as a reference for:
- How conversations and messages are structured
- How channel inboxes (FB, Instagram, WhatsApp, Email) are modeled
- How contacts are linked to conversations
- How webhooks from Meta are handled

---

## STEP 0 — Set Up Docker

1. Create docker-compose.yml in the project root that runs:
   - The FastAPI backend (from /backend)
   - Redis (for background jobs and websockets later)
   - Do NOT dockerize the frontend yet, keep it running with npm run dev
2. Make sure existing backend still works after dockerizing
3. Add a .env.example update if any new env vars are needed
4. Add clear comments in docker-compose.yml explaining each service

---

## STEP 1 — Database Schema (Supabase)

Create Alembic migrations (backend already uses SQLAlchemy) for these tables:

inboxes:
- id, workspace_id (user_id from Supabase), name, channel_type 
  (enum: facebook, instagram, whatsapp, email, website, api)
- channel_config (jsonb) — stores tokens/credentials per channel
- created_at

contacts:
- id, workspace_id, name, email, phone, avatar_url
- channel_identifiers (jsonb) — e.g. {facebook_id: "...", whatsapp: "..."}
- created_at

conversations:
- id, workspace_id, inbox_id, contact_id
- status (enum: open, resolved, pending)
- channel_type, last_message_at, created_at

messages:
- id, conversation_id, content, message_type (incoming/outgoing)
- sender_type (contact/agent), sender_id
- metadata (jsonb), created_at

---

## STEP 2 — FastAPI Backend Routes

Create /backend/app/inbox/ module with:

routers/inbox.py:
- GET /api/v1/inbox/conversations — list all with filters (status, channel)
- GET /api/v1/inbox/conversations/{id} — single conversation
- GET /api/v1/inbox/conversations/{id}/messages — messages in conversation
- POST /api/v1/inbox/conversations/{id}/messages — send message
- GET /api/v1/inbox/contacts — list contacts
- POST /api/v1/inbox/contacts — create contact

routers/channels.py:
- POST /api/v1/inbox/webhooks/facebook — receive FB/Instagram webhook
- POST /api/v1/inbox/webhooks/whatsapp — receive WhatsApp Cloud API webhook
- POST /api/v1/inbox/webhooks/email — receive inbound email webhook
- GET /api/v1/inbox/webhooks/facebook — webhook verification (Meta requires GET)

routers/integrations.py:
- GET /api/v1/integrations — list connected inboxes for this workspace
- POST /api/v1/integrations — save a new inbox/channel config
- DELETE /api/v1/integrations/{id} — disconnect a channel

All routes protected by existing Supabase JWT middleware.
Store channel credentials encrypted in channel_config jsonb field.

---

## STEP 3 — Channel Sending Logic

Create /backend/app/inbox/channels/ with one file per channel:

facebook.py — send message via Facebook Graph API
instagram.py — send message via Instagram Graph API  
whatsapp.py — send message via WhatsApp Cloud API
email.py — send email via SMTP (using credentials from channel_config)
website.py — placeholder for websocket-based live chat (implement later)

Each file should have a send_message(conversation, message_text) function.
The main message sending endpoint should call the right channel file 
based on conversation.channel_type.

---

## STEP 4 — Frontend Inbox UI (/frontend)

Create /dashboard/inbox route with:

Left panel — Conversation list:
- Show contact name, channel icon, last message preview, timestamp
- Filter tabs: All / Open / Resolved
- Channel filter: All, Facebook, Instagram, WhatsApp, Email, Website

Right panel — Conversation thread:
- Show all messages (incoming on left, outgoing on right)
- Message input box at bottom with send button
- Show channel name and contact info at top

Create /dashboard/settings/channels route:
- List connected channels
- Button to add new channel (Facebook, Instagram, WhatsApp, Email)
- For each channel type show a form to input required credentials:
  - Facebook/Instagram: Page Access Token + Page ID
  - WhatsApp: API Token + Phone Number ID + Business Account ID
  - Email: SMTP host, port, username, password

Match existing Tailwind styling in the project.
Use the existing API client pattern already in the frontend.

---

IMPORTANT:
- Do NOT touch existing working code (auth, customers, leads, orders)
- Keep backend modular — AI auto-reply features will be added later
  inside /backend/app/inbox/ai/ 
- Do not hardcode any credentials anywhere
- Ask before installing new major dependencies
- After each step confirm with me before moving to the next

## STEP 5 — Auth (Supabase)

Auth should be simple using Supabase built-in auth.
The backend JWT validation is already working, just need frontend pages.

Frontend pages to build:

/auth/login — email + password login form
/auth/signup — name, email, password, confirm password
/auth/forgot-password — email input, sends reset link via Supabase

After login:
- Store Supabase session token in localStorage or cookie
- Redirect to /dashboard
- All /dashboard/* routes should be protected (redirect to /login if not logged in)

After signup:
- Auto login and redirect to /dashboard/settings/channels 
  so user sets up their first inbox right away

Backend:
- Already validates Supabase JWT, no changes needed
- Just make sure all /api/v1/* routes return 401 if no valid token

Middleware:
- Create a Next.js middleware.ts in /frontend that protects 
  all /dashboard routes
- If no session, redirect to /auth/login

Use Supabase's built-in auth methods:
- supabase.auth.signInWithPassword()
- supabase.auth.signUp()
- supabase.auth.resetPasswordForEmail()
- supabase.auth.getSession()

Match existing Tailwind styling. Keep it clean and simple.
Do not use any third party auth library.