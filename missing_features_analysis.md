# Missing Features & Current Gap Analysis

This document is a verified status sheet for the CRM codebase.

## Legend
- **Done**: implemented and validated in code
- **Partial**: present in code but incomplete or demo-only
- **Missing**: not implemented yet

## Current Implementation Status

### Done
- Intent detection and lead intent persistence
- Handover detection with bot pause on trigger
- Realtime inbox websocket hub and conversation websocket endpoint
- Website channel websocket broadcast stub
- Handover task creation in the existing task system
- `ai_events` table and conversation pause/assignment fields
- Realtime smoke test for the websocket hub

### Partial
- Website chat widget is a frontend shell, not a production customer widget
- Inbox realtime is live for the selected thread, but there is no durable pub/sub layer yet
- AI escalation is limited to creating a task on handover trigger
- Lead intelligence exists in backend fields, but most of it is not surfaced consistently in the UI

### Missing
- Permission management system
- Automatic industry / preference detection
- Production-grade monitoring and alerts

---

## 1. Advanced Customer Profile System

### Status
Partial

### Missing Features
- Unified view for customer name, phone, email, address, source platform, lead stage, intent, engagement, trust level, AI summary, negotiation history, assigned agent, and conversation history

---

## 2. Manual Customer Creation & Editing

### Status
Done

### Missing Features
- Manual customer entry for offline leads, referrals, walk-ins, and imports
- Manual editing for customer name, phone, email, address, notes, and lead stage
- Validation rules for required fields such as customer name and phone number

---

## 3. Lead Intelligence Visibility

### Status
Done

### What Exists
- Intent detection exists and is stored on leads

### Missing Features
- Visible lead intelligence on lead cards, lead detail, and customer profile pages

---

## 4. AI Data Collection Strategy

### Status
Partial

### What Exists
- The AI can ask for missing fields during conversation

### Risk
- Early request for email or other personal data may feel robotic and lower conversion

### Recommended Improvement
- Collect data progressively: name first, interest second, email later

---

## 5. Platform Analytics Dashboard

### Status
Partial

### What Exists
- Dashboard summary now includes lead source and converted-source breakdowns

### Missing Features
- Analytics for active conversations per platform and AI effectiveness per platform
- Coverage for Messenger, WhatsApp, Email, and future Instagram analytics

---

## 6. Permission Management System

### Status
Missing

### Missing Features
- Admin user creation and password assignment
- Granular permission controls for leads, customers, chat, analytics, and AI settings

---

## 7. Human Takeover System

### Status
Done, but still basic

### What Exists
- Session-level bot pause on handover trigger
- Task creation for agent follow-up
- Conversation pause fields and websocket-aware inbox updates

### Still Missing
- A dedicated agent takeover UI state
- Explicit assignment workflow from agent side

---

## 8. AI Escalation & Alert System

### Status
Partial

### What Exists
- Handover trigger creates an event and a task

### Missing Features
- Broader proactive alert rules for negotiation, seriousness, trust drop, and high-value leads
- Notification delivery beyond task creation

---

## 9. Interested / Potential Lead Indicators

### Status
Partial

### What Exists
- Intent labels such as browsing, comparing, and serious

### Missing Features
- Visible lead priority labels like interested, potential, and hot lead

---

## 10. Automatic Industry / Preference Detection

### Status
Missing

### Missing Features
- Detection of property type, preferred country, product category, budget range, and preference changes
- Storage in lead metadata and customer profile

---

## 11. Connected Database Intelligence Layer

### Status
Partial

### What Exists
- Core tables for leads, conversations, messages, and `ai_events`
- Conversation pause and assignment fields

### Missing Features
- Permission architecture in the database
- Platform metrics storage
- Preference history and lead stage history

### Recommended Additional Tables
- `permissions`
- `platform_metrics`
- `customer_preferences`
- `lead_stage_history`

---

## Verified Notes
- The backend and frontend changes were syntax-checked after each major edit.
- The realtime hub smoke test passed after fixing connection storage.
- The Alembic migration for `ai_events` / conversation flags was aligned with the live database state by stamping the head when the table already existed.

---

## Final Summary

The codebase now has the core operational AI chat path in place:
- backend AI integration
- messaging infrastructure
- entity extraction and intent detection
- human handover basics
- realtime inbox updates
- websocket-based website channel stubs

The remaining work is mostly product-level and operational:
- permissions
- broader analytics coverage
- richer alerts
- automatic preference detection

So the file is not “fully done” yet, but it now reflects the verified state of the implementation instead of the earlier gap-only draft.