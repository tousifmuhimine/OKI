# OKKI CRM: Project Roadmap & Status

This document consolidates the current implementation status, identified gaps, and strategic improvements for the AI Conversational CRM.

---

## 1. Current State (Implementation: DONE)
The following core features are fully implemented and validated in the codebase:

- **AI Core:** Intent detection, entity extraction, and lead intent persistence.
- **Messaging:** Real-time inbox via WebSocket hub and conversation endpoints.
- **Handover System:** Session-level bot pausing on handover triggers with automatic task creation.
- **Lead Intelligence:** Intent, Engagement, and Trust levels visible on lead cards and profiles.
- **Customer Profiles:** Unified view for identity, AI summary, and platform source data.
- **Permissions:** User-based grant system with expanded keys (customers.view/manage, leads.view/manage, chat.view/manage, analytics.view, ai.settings, permissions.manage) + role preset UI.
- **Analytics Dashboard:** Full AI monitoring page (conversion rate, drop-off rate, handover count, AI response count, unread alerts) + per-platform breakdown table.
- **Manual Operations:** Manual customer creation and editing with validation rules for required fields (Name/Phone).
- **AI Conversation Stage Intelligence:** Progressive data collection — early/mid/late funnel stage detection with stage-specific system prompt injection.
- **Signal Detection:** Negotiation, frustration, high-intent, and drop-off pattern matching from message text.
- **Real-time Escalation Alerts:** AlertNotification created + WebSocket push via notification channel when signals are detected.
- **Notification Bell:** Live notification bell in header with unread count badge, dropdown with mark-as-read, mark-all-read, and link to analytics.
- **WebSocket Notification Channel:** `/notifications/ws` endpoint for workspace-level agent push notifications.
- **Notifications API:** Full CRUD — list, unread-count, mark-as-read, mark-all-read endpoints.

---

## 2. Remaining Gaps
These items are lower priority and can be addressed next:

### Infrastructure
- Production-grade monitoring (Sentry/Prometheus/ELK).
- Multi-timezone clock configuration persistence (currently session-only).
- Durable pub/sub layer for the Inbox (current realtime is live-only).

### Emerging Features
- **Website Channel:** The chat widget is still a frontend shell; needs a production-ready customer-facing implementation.
- **Auto-Resume Mode:** Automatic AI reactivation when an agent leaves a session (timer-based).
- **Alembic Migration:** Run `alembic revision --autogenerate` to capture any new columns added to `alert_notifications`.

---

## 3. Priority Order (Next Session)

1. **Alembic Migration** — Capture DB schema changes.
2. **Auto-Resume Timer** — When agent leaves, auto-resume bot after N minutes.
3. **Production Chat Widget** — Turn the website shell into a real customer communication widget.
4. **Sentry / Monitoring** — Add error tracking for production readiness.

---

*Last Updated: 2026-05-09 (Post Block A–E Implementation)*
