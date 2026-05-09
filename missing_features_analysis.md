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
- Advanced Customer Profile with unified history and intelligence
- Permission management system (User-based grants)
- Platform analytics dashboard (conversations, AI rates, handovers)

### Partial
- Website chat widget is a frontend shell, not a production customer widget
- Inbox realtime is live for the selected thread, but there is no durable pub/sub layer yet
- AI escalation is integrated into analytics and tasks, but missing push notifications
- Automatic industry / preference detection (Preference history is tracked but detection logic is emerging)

### Missing
- Production-grade monitoring and alerts (ELK/Sentry/Prometheus)
- Multi-timezone clock configuration persistence (current is session-based)

---

## 1. Advanced Customer Profile System

### Status
Done

### Features Implemented
- Unified view for customer name, phone, email, address, source platform, lead stage, intent, engagement, trust level, AI summary, negotiation history, assigned agent, and conversation history.
- Dynamic preference history tracking and display.

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
- Intent detection exists and is stored on leads.
- Visible lead intelligence on lead cards, lead detail, and customer profile pages (Intent, Engagement, Trust Level).

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
Done

### What Exists
- Dashboard summary includes lead source and converted-source breakdowns.
- Analytics for active conversations, new conversations, AI events, and handovers per platform.
- Support for Messenger, WhatsApp, Email, and Website channels.

---

## 6. Permission Management System

### Status
Done

### What Exists
- Granular permission controls for customers, leads, tasks, AI settings, and permissions management.
- User-based grant system with UI for managing access.

---

## 7. Human Takeover System

### Status
Done

### What Exists
- Session-level bot pause on handover trigger.
- Task creation for agent follow-up.
- Conversation pause fields and websocket-aware inbox updates.
- Agent assignment workflow from agent side (visible in customer profiles).

---

## 8. AI Escalation & Alert System

### Status
Done

### What Exists
- Handover trigger creates an event and a task.
- Proactive analytics tracking for handovers and AI events.
- Monitoring of AI effectiveness (AI rate) per platform.

---

## 9. Interested / Potential Lead Indicators

### Status
Done

### What Exists
- Intent labels such as browsing, comparing, and serious.
- Visible lead priority labels like intent and engagement on lead cards and profiles.

---

## 10. Automatic Industry / Preference Detection

### Status
Partial

### What Exists
- Storage and display of preference history (detected from messages).
- Industry/Type selection for customers (ecommerce, real_estate, study_abroad).

### Still Missing
- Full automatic detection logic for country, budget range, and preference changes (currently requires manual or simple extraction).

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