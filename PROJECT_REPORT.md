# Oki Clone — Project Report

Date: 2026-05-06

This document summarizes the implemented features, architecture, and important files for the Oki Clone workspace.

## High-level overview

- Backend: FastAPI (Python 3.12), SQLAlchemy 2.0 (async), Alembic migrations, PostgreSQL (Supabase). Per-user AI configuration stored in `UserLLMConfig`.
- Frontend: Next.js 16 (TypeScript, TailwindCSS). Type definitions under `frontend/types` and pages under `frontend/app`.
- AI integrations: Groq provider with per-user encrypted API keys. Services for reply generation, entity extraction, and intent detection.

---

## Completed roadmap features (Steps 1–6)

1. Step 1 — Company Type Support
   - DB: `customers.type` column (String(64), nullable, indexed).
   - Files:
     - backend/migrations/versions/20260506_0004_add_company_type_to_customers.py
     - backend/app/db/models.py (Customer.type)
     - frontend/app/customers/page.tsx (type dropdown UI)
     - frontend/types/crm.ts (Customer type)

2. Step 2 — Extend Lead Model
   - Added dynamic lead fields via migration `20260506_0005_extend_lead_model.py`:
     - intent, engagement, trust_level, budget_min, budget_max, last_summary, assigned_agent_id
   - Files:
     - backend/app/db/models.py (Lead fields)
     - backend/app/schemas/lead.py (LeadBase, LeadUpdate, LeadOut)

3. Step 3 — Message Storage System
   - Conversations and Messages tables with full CRUD.
   - Files:
     - backend/migrations/versions/20260428_0001_create_inbox_tables.py
     - backend/app/schemas/inbox.py and related models
     - Backend message ingestion and persistence implemented in `app/inbox/routers/channels.py` and helpers.

4. Step 4 — Basic AI Reply System
   - Service: `generate_ai_reply(session, message, company_type)` (per-user Groq config)
   - System prompts per company type (ecommerce, real_estate, study_abroad, default).
   - Endpoint: POST `/inbox/ai/reply` (See `app/inbox/routers/ai.py`)
   - Files:
     - backend/app/services/ai_reply.py
     - backend/app/inbox/routers/ai.py

5. Step 5 — Data Extraction From Chat
   - Service: AI-powered entity extraction returns name, phone, email, address, budget.
   - Robust JSON parsing with regex fallback.
   - Update lead fields only if currently empty.
   - Endpoint: POST `/inbox/ai/extract-entities`
   - Files:
     - backend/app/services/entity_extraction.py (extract_entities_from_message, update_lead_from_extracted_entities)
     - backend/app/inbox/routers/ai.py (router changes)
     - test script: backend/scripts/test_step5_... (pattern)

6. Step 6 — Intent Detection ✅ COMPLETE
   - Service: `detect_intent_from_message(session, message)` classifies into: `browsing`, `comparing`, `serious`.
   - Persists detected intent to `lead.intent` via `update_lead_intent`.
   - Endpoint: POST `/inbox/ai/detect-intent`
   - Test harness: `backend/scripts/test_step6_intent.py` (stubs Groq responses to validate behavior).
   - Files:
     - backend/app/services/entity_extraction.py
     - backend/app/inbox/routers/ai.py

---

## Live inbound chat flow (what the bot does now)

- Inbound messages are processed by `backend/app/inbox/routers/channels.py`:
  1. Message stored to `Message` table via `_store_message`.
  2. `upsert_lead_from_inbound_message` ensures a Lead exists or is updated from contact.
  3. `maybe_auto_reply` runs if the user's `UserLLMConfig` has `automation_modes` for the platform set to `chatbot`.
  4. New behavior: the auto-reply flow now:
     - runs `detect_intent_from_message` and persists `lead.intent` if available,
     - computes missing fields (`name`, `email`) from the `Contact` and `Lead`,
     - builds a system prompt that instructs the assistant to ask for missing name/email first (short, single follow-up) before other replies,
     - generates the reply using the configured Groq key and sends via the channel adapter (`send_channel_message`).

Files:
- backend/app/inbox/routers/channels.py — ingestion + `_maybe_auto_reply` (qualification logic wired)
- backend/app/services/entity_extraction.py — intent detection + extraction

---

## Important backend endpoints (summary)

- AI & config
  - GET `/inbox/ai/config` — list per-user LLM configs
  - POST `/inbox/ai/config` — upsert user LLM config
  - DELETE `/inbox/ai/config/{id}` — delete config
- AI actions
  - POST `/inbox/ai/reply` — generate AI reply (service: `generate_ai_reply`)
  - POST `/inbox/ai/extract-entities` — extract entities from message (service: `extract_entities_from_message`)
  - POST `/inbox/ai/detect-intent` — detect intent and optional lead update (service: `detect_intent_from_message`)
- Leads
  - POST `/leads` — create lead
  - POST `/leads/ai-convert` — convert raw notes to lead via AI (`ai_convert.py`)
  - GET/POST/PATCH endpoints under `/leads` for list, detail, convert
- Incoming webhooks
  - `/inbox/webhooks/facebook`, `/inbox/webhooks/instagram`, `/inbox/webhooks/whatsapp`, `/inbox/webhooks/email` handled by `app/inbox/routers/channels.py`.

---

## Database & Migrations

- migrations/versions/20260428_0001_create_inbox_tables.py — conversations/messages tables
- migrations/versions/20260506_0004_add_company_type_to_customers.py — add Customer.type
- migrations/versions/20260506_0005_extend_lead_model.py — add intent, engagement, trust_level, budget_min, budget_max, last_summary, assigned_agent_id
- Key models: `backend/app/db/models.py` (Customer, Lead, Opportunity, Product)

---

## AI design & security

- Per-user AI configs are stored in `UserLLMConfig` with `encrypted_config` containing the provider API key.
- Encryption/decryption helpers live in `app/inbox/security.py` and are used when sending requests to Groq.
- Provider-specific code for Groq is in `app/inbox/llm_providers/groq.py` with `GroqProvider` abstraction used across services.
- All AI calls are executed with the user's own key (no org-wide key used for generation).

---

## Frontend

- `frontend/app/customers/page.tsx` — customers UI with `type` dropdown.
- `frontend/app/leads/page.tsx` — leads list and lead detail UI; lead detail renders email/phone and new fields when present.
- Types updated in `frontend/types/crm.ts` to include `Customer.type` and the extended Lead shape.
- Frontend builds successfully; `npm run build` ran successfully during verification.

---

## Tests & Scripts

- `backend/scripts/test_step6_intent.py` — intent detection test harness that stubs Groq responses and verifies persistence.
- Other step test scripts exist under `backend/scripts/` (pattern `test_stepX_*.py`) used during incremental development to validate each feature.

---

## Key implementation files (quick map)

- backend/app/services/ai_reply.py — AI reply generation and system prompts
- backend/app/services/entity_extraction.py — entity extraction, intent detection, lead-updating helpers
- backend/app/services/ai_convert.py — convert agent notes to lead (Direct-Entry template)
- backend/app/services/lead_capture.py — upsert leads from inbound messages
- backend/app/inbox/routers/ai.py — AI-related API endpoints
- backend/app/inbox/routers/channels.py — inbound webhook handling, message storage, auto-reply logic
- backend/app/db/models.py — DB models for Customer, Lead, Message, Conversation, etc.
- frontend/... — pages and components (customers, leads, types)

---

## How to run (development)

Backend (from repo root):

```powershell
cd "e:\Codes\Oki Clone\backend"
# activate venv (example)
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd "e:\Codes\Oki Clone\frontend"
npm install
npm run dev
# or build
npm run build
```

Tests (examples):

```powershell
cd "e:\Codes\Oki Clone\backend"
.venv\Scripts\Activate.ps1
python -m py_compile app/inbox/routers/channels.py
python scripts/test_step6_intent.py
```

---

## Observations, risks & next steps

- Handover detection (Step 7) is marked CRITICAL and not yet implemented — needed to safely route price/payment/visit intent to human agents.
- Current auto-reply asks for missing name/email and updates `lead.intent`. Consider immediate handover when intent == `serious` for high-value flows.
- Monitor AI usage per-user to detect abuse or excessive costs; add rate-limiting and metrics (Step 15)
- Add more unit tests around the AI parsing fallbacks (JSON-with-noise) and end-to-end webhook flows.

---

## Where I changed code recently

- backend/app/services/entity_extraction.py — added intent classifier, helper parsing, and update helpers
- backend/app/inbox/routers/ai.py — added `/detect-intent` endpoint
- backend/scripts/test_step6_intent.py — added test harness
- backend/app/inbox/routers/channels.py — wired intent detection and qualification prompting into `_maybe_auto_reply`
- lead_manage.md — updated roadmap status for Steps 5 and 6

---

If you want, I can:
1. Add Step 7 (handover detection) next and implement immediate handover rules for `serious` intent.
2. Produce a short sequence diagram (Mermaid) of the inbound message → AI → lead update → reply flow.
3. Expand the PROJECT_REPORT.md with per-file code links and line references.

---

File created: PROJECT_REPORT.md
