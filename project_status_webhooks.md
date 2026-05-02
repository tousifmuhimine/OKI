# OKKI CRM — Project Status Summary

> **Last updated:** 2026-05-02 · Session: Dashboard Modernization, Calendar & Tasks

---

## 🟢 System Health (Current)

| Service | Status | URL |
|---|---|---|
| Frontend (Next.js 16) | ✅ Running | `http://localhost:3000` |
| Backend (FastAPI / Uvicorn) | ✅ Running | `http://localhost:8000` |
| Database (Supabase / PostgreSQL) | ✅ Connected | Supabase cloud |
| Backend Health Endpoint | ✅ `{"status":"ok"}` | `http://localhost:8000/api/v1/health` |

---

## ✅ Features Implemented (Cumulative)

### 1. Dashboard Modernization (`/dashboard`)
- **Interactive Multi-Timezone Clock** — Elegantly styled clock with a custom-themed dropdown to switch between Dhaka, Sydney, Beijing, Toronto, London, New York, etc.
- **Functional Schedule Calendar** — Replaced static mock data with a real React calendar component.
  - **Views:** Switch between **List** (upcoming events) and **Month** (date grid) views.
  - **Local Time Fix:** Calendar correctly highlights the current date (May 2) using local timezone logic instead of UTC.
  - **Live Tasks API:** Calendar events are fetched from the new `/tasks` backend API.
- **Add Event Modal** — Quick-add events directly to the calendar from the dashboard.
- **KPI Summary** — Live counts for Customers, Opportunities, and Orders.

### 2. Lead Operations (`/leads`)
- **Real-time CRUD** — create, list, filter, search leads from Supabase.
- **Board & List view** — switchable with drag-and-drop status transitions (backend PATCH on drop).
- **Auto-capture** — leads auto-created from WhatsApp / Messenger / Email webhooks (`capture_source: "auto"`).
- **Convert to Customer Flow** — Budget modal (BDT) → Automated creation of Customer, Opportunity, Draft Invoice, Task, and Audit Log.

### 3. Sales Pipeline (`/pipeline`)
- **Live Data Kanban** — Fetches real `Opportunity` records from `/api/v1/opportunities`.
- **KPI Metrics** — Total Pipeline Value, Active Deals, Won Value, Win Rate (all live).
- **Multi-currency display** — Toggle between BDT, USD, AED, etc., with real-time conversion.

### 4. Trading & Orders (`/orders`)
- **Customer Identity** — Orders now show the **Customer Company Name** (joined from DB) instead of just a raw ID.
- **Clean UI** — Truncated IDs and branded icons for a more premium look.

### 5. Header & Shell
- **Quick Create Modal** — Global `+New` button to rapidly create Leads or Customers from any page.

---

## 🏗️ Backend Architecture

```
FastAPI (Uvicorn, async SQLAlchemy + PostgreSQL via Supabase)
├── /api/v1/tasks          — CRUD + Month/Entity filtering (NEW)
├── /api/v1/leads          — CRUD + convert endpoint + analytics
├── /api/v1/customers      — CRUD
├── /api/v1/opportunities  — CRUD + stage PATCH (pipeline)
├── /api/v1/orders         — Sales orders / invoices (Joined Customer Name)
├── /api/v1/dashboard      — Summary stats
├── /api/v1/inbox          — Conversations, messages
└── /api/v1/health         — Health check
```

---

## 🐛 Bugs Fixed This Session

| Bug | Fix |
|---|---|
| Calendar showing May 3 instead of May 2 | Switched from UTC `toISOString` to local date comparison logic. |
| Timezone dropdown hidden under cards | Added `relative z-50` stacking context to the dashboard header. |
| Native dropdown look vs site theme | Implemented custom themed absolute-positioned dropdown for clocks. |
| Orders page missing customer names | Added `LEFT JOIN` on Customer table in `/orders` API. |
| `entity_id` required for all Tasks | Made `entity_id` nullable in `models.py` to allow standalone events. |

---

## 📁 Key Files

| File | Purpose |
|---|---|
| `app/dashboard/page.tsx` | Dashboard UI — Clock, Calendar, KPIs, Event Modal |
| `backend/app/api/routes/tasks.py` | New Task API for calendar events |
| `backend/app/api/routes/orders.py` | Updated Order API with Customer Join |
| `backend/app/schemas/task.py` | Pydantic schemas for Tasks |
| `backend/app/db/models.py` | Updated Task model (nullable entity_id) |

---

## 🔜 Next Steps

- [ ] Opportunity detail view — edit title, value, stage from pipeline.
- [ ] Customer detail page — linked leads, opportunities, invoices.
- [ ] Audit log viewer (admin panel to see all actions).
- [ ] Real-time updates via WebSocket or Supabase Realtime subscriptions.
