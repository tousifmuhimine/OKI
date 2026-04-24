# OKKI CRM Clone Parity Roadmap

Date: 2026-04-23
Target stack: Next.js frontend, FastAPI backend, Supabase (Postgres/Auth/Storage)

## 1) Feasibility Verdict

Short answer: yes, it is possible to implement all features listed in guideline.md.

Important precision:
- Functional parity: Yes, feasible.
- Workflow parity: Yes, feasible with staged delivery.
- Source-code parity with the original vendor app: Not feasible (you only have production bundles, not source code).
- Exact behavior parity in every edge case from day 1: Not realistic without reverse-engineering and iterative UAT.

## 2) Parity Definition (What "done" means)

This roadmap uses three parity levels:
- L1 Core parity: same business outcomes and primary workflows.
- L2 Operational parity: same admin controls, analytics depth, and automation coverage.
- L3 Competitive parity: AI quality, performance, and UX close to enterprise-grade reference.

## 3) Dependency Reality Check

All features are buildable, but some depend on external systems:
- Facebook/WhatsApp/Instagram integrations require official app approvals and production credentials.
- Email reliability requires SMTP/API provider setup, domain auth (SPF/DKIM/DMARC), and reputation warmup.
- AI recommendation quality depends on data quality and model/prompt strategy.
- Enterprise-grade observability and auditability need extra engineering, not just CRUD.

## 4) Module-by-Module Parity Matrix

| Guideline Module | Parity Target | Feasibility | Main Dependencies | Target Phase |
|---|---|---|---|---|
| 4.1 Authentication and User Management | L2 | High | Supabase Auth, RBAC tables, JWT strategy | Phase 1 |
| 4.2 Customer Management (core CRM) | L3 | High | Customer schema, tags, scoring, timeline events | Phase 2 |
| 4.3 Product Management | L2 | High | Product schema, storage uploads, category model | Phase 2 |
| 4.4 Sales Order Management | L2 | High | Order lifecycle state machine, payment status model | Phase 3 |
| 4.5 Workbench (Dashboard) | L2 | High | KPI aggregation jobs, event telemetry | Phase 5 |
| 4.6 Email System | L2 | Medium-High | Provider integration, threading model, template engine | Phase 4 |
| 4.7 Communication Hub | L2 | Medium | Channel APIs, webhook ingestion, unified inbox model | Phase 4 |
| 4.8 Lead Management (Clue) | L3 | High | Lead pipeline tables, conversion workflows | Phase 3 |
| 4.9 Business Opportunities (Pipeline) | L3 | High | Opportunity stages, valuation, transition rules | Phase 3 |
| 4.10 Data Analytics | L2 | High | Materialized views, BI queries, caching | Phase 5 |
| 4.11 AI System | L2 then L3 | Medium-High | Rule engine first, LLM orchestration later | Phase 6 |
| 4.12 KPI and Target Management | L2 | High | Goal tables, progress calculators, ranking queries | Phase 5 |
| 4.13 Collaboration System | L2 | High | Tasks, approvals, schedule, shared files | Phase 4 |
| 4.14 Admin and Settings | L2 | High | Permission matrix, feature flags, custom fields | Phase 1 then 6 |
| 4.15 Global Search | L2 | High | Postgres FTS/trigram, index strategy | Phase 6 |

Conclusion from matrix: all listed modules are implementable. The highest uncertainty is third-party channel integration and advanced AI behavior quality, not core CRM architecture.

## 5) Delivery Phases

### Phase 0: Discovery and Architecture Baseline (1-2 weeks)
- Finalize parity scope and acceptance criteria per module.
- Define bounded contexts: Auth, CRM, Sales, Communication, Analytics, AI, Admin.
- Design shared event taxonomy (create/update/status_change/message/task events).
- Produce ERD and API contract skeleton.

Exit criteria:
- Approved architecture document.
- Approved DB schema v1.
- Approved API naming and versioning rules.

### Phase 1: Foundation (2-3 weeks)
- Authentication, session handling, role hierarchy (Admin/Manager/User).
- Organization, team, ownership, and permission checks.
- Base app shell, navigation, notifications framework, audit logging foundation.
- Admin basics: role permissions and feature toggles.

Exit criteria:
- Secure login + role-gated routes and APIs.
- Action-level authorization on key entities.
- Basic audit records for critical write operations.

### Phase 2: Core CRM and Product (4-5 weeks)
- Customer CRUD, assignment, stages, groups, tags, scoring baseline.
- Customer list with advanced filtering, sorting, pagination, bulk actions.
- Activity timeline and follow-up tracking.
- Product CRUD, categories, image upload, bulk operations.

Exit criteria:
- Customer workflow complete for day-to-day operations.
- Product catalog operational with upload and list workflows.

### Phase 3: Leads, Opportunities, Orders (4-5 weeks)
- Lead lifecycle and conversion to customer.
- Opportunity pipeline with stage transitions and value tracking.
- Order lifecycle (Draft -> Placed -> Shipped -> Completed).
- Payment status (Pending -> Partial -> Paid).

Exit criteria:
- End-to-end journey from lead to order is fully executable.
- Stage transitions are audited and permission-guarded.

### Phase 4: Communication and Collaboration (4-6 weeks)
- Email inbox/sent/draft/threading/attachments/templates.
- Channel connectors (prioritized rollout: WhatsApp first, then Facebook/Instagram).
- Unified communication timeline linked to customers/leads.
- Tasks, schedules, approvals, shared files, reminders.

Exit criteria:
- Unified inbox operational for at least one external channel + email.
- Team collaboration flows usable in production.

### Phase 5: Dashboard, KPI, Analytics (3-4 weeks)
- Workbench widgets, schedules, recommendations, alerts.
- KPI definitions, target management, team ranking.
- Reporting filters and export flows.

Exit criteria:
- Management can run daily/weekly performance review from the platform.
- KPI calculations are reproducible and validated.

### Phase 6: AI and Search (3-4 weeks)
- Rule-based AI insights (anomaly flags, follow-up suggestions).
- LLM-ready service layer (prompt templates, guardrails, fallback logic).
- Global search across customers/orders/products/messages.
- Admin advanced settings: custom fields, dedupe rules, email config polishing.

Exit criteria:
- AI suggestions are actionable and measurable.
- Search latency and relevance are acceptable at expected scale.

### Phase 7: Hardening and Go-Live (2-3 weeks)
- Security review, performance tuning, index optimization.
- Migration scripts, backup strategy, runbooks, monitoring dashboards.
- UAT closure, bug burn-down, rollout plan.

Exit criteria:
- Production readiness checklist signed off.
- Critical workflows pass UAT with agreed SLAs.

## 6) Estimated Effort and Team Shape

Suggested team for strong parity in one major release train:
- Frontend engineers: 2-3
- Backend engineers: 2-3
- QA engineer: 1
- DevOps/SRE: part-time to full-time depending on scale
- Product/BA support: 1

Rough timeline:
- Aggressive MVP parity (core CRM + leads + orders): 12-16 weeks
- Broad parity (most guideline modules): 20-28 weeks
- Mature parity with AI and full channel depth: 28-36 weeks

## 7) Suggested Supabase/FastAPI Data Domains

Core tables:
- users, roles, role_permissions, teams, team_members
- customers, customer_contacts, customer_tags, customer_scores, customer_timeline
- leads, lead_contacts, lead_events
- opportunities, opportunity_stages, opportunity_events
- products, product_categories, product_media
- orders, order_items, order_status_history, payments
- emails, email_threads, email_templates, email_attachments
- messages, channels, channel_accounts, message_threads
- tasks, schedules, approvals, notifications
- kpis, targets, reports_snapshots
- workflows, workflow_rules, workflow_runs
- audit_logs, feature_flags, custom_fields

Service layers:
- FastAPI domain routers with explicit service and repository boundaries.
- Background jobs for KPI refresh, reminders, notifications, AI scoring.

## 8) Risk Register with Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Third-party API approval delays | High | Build adapters behind interfaces; ship with email + internal chat first |
| Hidden business rules from original platform | High | Capture rules through UAT scripts and iterative parity tests |
| Data model drift over time | Medium | Use migration discipline, schema governance, and contract tests |
| AI hallucination or low trust | Medium | Start rule-based, add confidence thresholds, human confirmation paths |
| Performance degradation under growth | Medium | Add indexes early, async workers, materialized reporting views |

## 9) Parity Acceptance Checklist

A feature is accepted only when all are true:
- Workflow parity: the same business task can be completed end-to-end.
- Permission parity: role and ownership controls match agreed policy.
- Data parity: required fields and lifecycle states are preserved.
- Audit parity: important transitions are logged and explainable.
- UX parity: operational users can complete common tasks without regressions.

## 10) Recommended Next Step (Before Coding)

Run a 5-day parity discovery sprint:
- Day 1: finalize module-level acceptance criteria.
- Day 2: lock ERD and RBAC matrix.
- Day 3: lock API contracts for Phase 1-3.
- Day 4: define external integration order and fallback behaviors.
- Day 5: convert this roadmap into sprint backlog with estimates.

If this sprint is completed well, building all guideline features is realistic with controlled risk.