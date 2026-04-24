# Frontend (Next.js + Supabase Auth)

This frontend is the first build pass of the CRM UI:
- Supabase login
- Protected routes
- Dashboard summary
- Customer, lead, and order starter pages wired to FastAPI

## 1. Setup

```bash
cd frontend
npm install
copy .env.example .env.local
```

Fill `.env.local` with Supabase values and backend URL.

## 2. Run

```bash
npm run dev
```

App URL: `http://localhost:3000`
