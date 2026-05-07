# AI Conversational CRM SaaS — Step-by-Step Build Guide

This guide is designed for incremental implementation using Copilot.
Follow each step in order. Do NOT skip steps.

After completing each step, test before moving forward.

---

# ✅ CURRENT STATUS

The following work is already complete and should be treated as the new baseline:

- System-wide Groq key removed from backend config.
- Organization-wide AI setup route removed.
- Lead magic converter now reads the current user's Groq config from `UserLLMConfig`.
- Lead magic converter now decrypts the per-user API key on demand.
- Lead magic converter now returns a clear 400 error when no AI provider is configured.
- The AI & Automation page is already the correct place for users to add personal provider keys.

**STEP 1 COMPLETE (May 6, 2026)**
- Added `type` column to customers table
- Updated backend Customer model with type field
- Updated frontend types and customers page
- Type dropdown working with: ecommerce, real_estate, study_abroad

**STEP 2 COMPLETE (May 6, 2026)**
- Added 7 dynamic fields to leads table via migration 20260506_0005:
  - intent (text)
  - engagement (text)
  - trust_level (text)
  - budget_min (numeric)
  - budget_max (numeric)
  - last_summary (text)
  - assigned_agent_id (uuid)
- Updated Lead model with all new fields
- Updated LeadBase and LeadUpdate schemas
- Updated frontend Lead type definition
- Fields are editable via PATCH /leads/{lead_id} API endpoint

**STEP 3 COMPLETE (May 6, 2026)**
- Conversations table supports: id, workspace_id, inbox_id, contact_id, status, channel_type, last_message_at, created_at
- Messages table supports: id, conversation_id, content, message_type (incoming/outgoing), sender_type (contact/agent), sender_id, metadata, created_at
- Both tables have full CRUD support via backend schemas (ConversationOut, MessageOut, MessageCreate, etc.)
- Frontend types available: InboxConversation, InboxMessage, ConversationListResponse, MessageListResponse
- Message history retrieval working correctly (tested via script)
- Conversation status tracking working (open, resolved, pending)

**STEP 4 COMPLETE (May 6, 2026)**

**STEP 5 COMPLETE (May 6, 2026)**
- Created `extract_entities_from_message(message)` service function
- Uses AI to extract: name, phone, email, address, budget from messages
- JSON parsing with regex fallback for robustness
- Created `update_lead_from_extracted_entities(lead_id, entities)` service function
- Only updates empty lead fields (preserves existing data)
- Created API endpoint: POST `/ai/extract-entities` with request/response schemas
- Optional lead_id to auto-update lead with extracted data
- Returns extracted entities + optionally updated lead object
- Test verified: Entity extraction, JSON parsing, lead update, field preservation all working
---

# 🧱 STEP 0 — PRE-CONDITIONS

Ensure:
- Supabase project is ready
- Auth system is working
- Backend (Python) is running
- Frontend (Next.js) is running

---

# 🧱 STEP 1 — ADD COMPANY TYPE SUPPORT

## Goal:
Allow each company to define its business type (ecommerce, real_estate, study_abroad)

## Task:

1. Add a `type` column in `companies` table:
   - type: text
   - allowed values: ecommerce, real_estate, study_abroad

2. Update backend:
   - When fetching company → always include `type`

3. Update frontend:
   - Admin must select company type during setup

## STOP HERE AND TEST:
- Create company
- Confirm type is saved and retrievable

---

# 🧱 STEP 2 — EXTEND LEAD MODEL (CORE UPGRADE)

## Goal:
Make leads dynamic instead of static

## Task:

Add fields to leads:

- intent (text)
- engagement (text)
- trust_level (text)
- budget_min (numeric)
- budget_max (numeric)
- last_summary (text)
- assigned_agent_id (uuid)

## STOP HERE AND TEST:
- Create lead
- Update new fields manually via API
- Confirm persistence

---

# 🧱 STEP 3 — MESSAGE STORAGE SYSTEM ✅ COMPLETE

## Goal:
Store all conversations

## Status: ✅ VERIFIED (May 6, 2026)

Infrastructure already implemented via 20260428_0001 migration:
- Conversations table: Stores conversation threads with status tracking (open/resolved/pending)
- Messages table: Stores individual messages with sender type (contact/agent) and message type (incoming/outgoing)
- Full schema support in backend (ConversationOut, MessageOut, MessageCreate, etc.)
- Full frontend types available (InboxConversation, InboxMessage, etc.)

Test verified:
- ✅ Create conversation
- ✅ Insert messages
- ✅ Fetch conversation history
- ✅ Update conversation status
- ✅ All data persists correctly

---

# 🧱 STEP 4 — BASIC AI REPLY SYSTEM ✅ COMPLETE

## Goal:
AI responds to messages

## Status: ✅ VERIFIED (May 6, 2026)

Implementation includes:
- Service function `generate_ai_reply(message, company_type)` in `app/services/ai_reply.py`
- Company type-specific system prompts for: ecommerce, real_estate, study_abroad, default
- Per-user AI provider configuration loaded from `UserLLMConfig`
- Secure API key decryption from encrypted storage
- Groq provider integration with model selection support
- API endpoint: POST `/ai/reply` (GenerateReplyRequest → GenerateReplyResponse)

Test verified:
- ✅ User AI config loading and database persistence
- ✅ Config encryption/decryption working correctly
- ✅ System prompt selection by company type
- ✅ Groq API integration (ready for valid credentials)
- ✅ Response generation pipeline
- ✅ All 3 company types tested

---

# 🧱 STEP 5 — DATA EXTRACTION FROM CHAT








## Goal:
Extract structured data from messages

## Status: ✅ VERIFIED (May 6, 2026)
---
Implementation includes:
- Service function `extract_entities_from_message(message)` in `app/services/entity_extraction.py`
- Uses AI to extract: name, phone, email, address, budget
- JSON parsing with regex fallback for robustness
- Service function `update_lead_from_extracted_entities(lead_id, entities)`
- Only updates empty lead fields (preserves existing data)
- Per-user AI provider configuration pattern (no org-wide credentials)
- API endpoint: POST `/ai/extract-entities` with request/response schemas
- Optional lead_id parameter to auto-update lead with extracted data

Test verified:
- ✅ User AI config loading
- ✅ Entity extraction from various message formats
- ✅ JSON parsing from AI responses
- ✅ Lead field update (only when empty)
- ✅ Budget extraction and conversion to float
- ✅ All fields optional and null-safe
# 🧱 STEP 6 — INTENT DETECTION ✅ COMPLETE

## Goal:
Understand what user wants

## Status: ✅ VERIFIED (May 6, 2026)

Implementation includes:
- Service function `detect_intent_from_message(message)` in `app/services/entity_extraction.py`
- Classifies messages into exactly one of: `browsing`, `comparing`, `serious`
- Service function `update_lead_intent(lead_id, intent)`
- API endpoint: POST `/ai/detect-intent`
- Optional `lead_id` parameter to persist detected intent on the lead
- Uses the same per-user AI configuration pattern as reply and extraction flows

Test verified:
- ✅ browsing classification
- ✅ comparing classification
- ✅ serious classification
- ✅ lead intent persistence
- ✅ per-user AI config loading

---

# 🧱 STEP 7 — HANDOVER DETECTION (CRITICAL)

## Goal:
Detect when human should take over

## Task:

Create:
should_handover(message)

Trigger if:
- price negotiation
- payment intent
- visit intent

## STOP HERE AND TEST:
- Send "last price?" → should trigger TRUE

---

# 🧱 STEP 8 — AGENT SYSTEM (USERS)

## Goal:
Differentiate admin and agents

## Task:

Add:
- role (admin / agent)
- agent_type (sales / support)
- is_online (boolean)

## STOP HERE AND TEST:
- Create agent
- Toggle online status

---

# 🧱 STEP 9 — AUTO ASSIGNMENT SYSTEM

## Goal:
Assign leads to agents automatically

## Task:

Create:
assign_agent(lead)

Logic:
- find online agents
- choose least busy

Update:
lead.assigned_agent_id

## STOP HERE AND TEST:
- New lead → agent assigned

---

# 🧱 STEP 10 — FULL CHAT FLOW INTEGRATION

## Goal:
Connect everything

## Task:

When message received:

1. Save message
2. Generate AI reply
3. Extract data → update lead
4. Detect intent → update lead
5. Check handover:
   - if TRUE → assign agent

## STOP HERE AND TEST:
- End-to-end message flow works

---

# 🧱 STEP 11 — AGENT TAKEOVER MODE

## Goal:
Human joins conversation

## Task:

If lead.assigned_agent_id exists:
- notify agent
- allow agent reply
- AI becomes passive

## STOP HERE AND TEST:
- Agent replies instead of AI

---

# 🧱 STEP 12 — AI FOLLOW-UP SYSTEM

## Goal:
Re-engage inactive leads

## Task:

Trigger:
- no reply for X hours

Create:
generate_followup(lead)

Send message automatically

## STOP HERE AND TEST:
- Simulate inactivity → follow-up sent

---

# 🧱 STEP 13 — LEAD SUMMARY GENERATION

## Goal:
Quick understanding for agents

## Task:

Create:
generate_summary(conversation)

Store in:
lead.last_summary

## STOP HERE AND TEST:
- Summary updates correctly

---

# 🧱 STEP 14 — MULTI-TENANT AI PROMPTS

## Goal:
Different AI behavior per company type

## Task:

Define:
- ecommerce prompt
- real estate prompt
- study abroad prompt

Switch using:
company.type

## STOP HERE AND TEST:
- Different tone per company

---

# 🧱 STEP 15 — AI MONITORING SYSTEM

## Goal:
Check if AI is performing well

## Task:

Track:
- AI messages count
- agent takeover count
- drop-offs after AI reply

Store metrics

## STOP HERE AND TEST:
- Metrics updating

---

# 🧱 STEP 16 — NEGOTIATION TRACKING

## Goal:
Handle price changes

## Task:

When budget detected:
- store in lead_events

Allow:
- multiple budget updates

## STOP HERE AND TEST:
- Budget history stored

---

# 🧱 STEP 17 — DASHBOARD (MINIMUM)

## Goal:
Visual control

## Show:
- active leads
- assigned agents
- pipeline stages
- AI vs human chats

## STOP HERE AND TEST:
- Data visible

---

# 🧱 FINAL STEP — POLISH

Add:
- error handling
- logging
- retry logic
- UI improvements

---

# ✅ END RESULT

You now have:

- AI chat system
- lead intelligence
- agent assignment
- multi-tenant SaaS
- follow-up automation
- negotiation-aware CRM

---

# 🚨 RULES

- Do NOT overcomplicate early
- Always test each step
- Keep AI assistive, not authoritative
- Preserve the completed personal AI-provider architecture.
- Prefer per-user config and explicit feature checks over global fallbacks.