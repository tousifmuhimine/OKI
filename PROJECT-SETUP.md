# OKI CRM Clone - First Build Setup

## What is implemented in this first build

- Separate apps:
  - `frontend` (Next.js + Tailwind + Supabase Auth)
  - `backend` (FastAPI + SQLAlchemy + Supabase Postgres/JWT)
- Auth flow:
  - Frontend login via Supabase email/password
  - Backend validates Supabase JWT bearer token
- Starter feature APIs and pages:
  - Dashboard summary
  - Customers (list/create)
  - Leads (list/create)
  - Orders (list/create)

## 1) Backend setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill `.env` with real Supabase values.

Run backend:

```powershell
uvicorn app.main:app --reload --port 8000
```

## 2) Frontend setup

Open a second terminal:

```powershell
cd frontend
npm install
Copy-Item .env.example .env.local
```

Fill `.env.local`:

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`
- `NEXT_PUBLIC_SUPABASE_URL=...`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

Run frontend:

```powershell
npm run dev
```

Open: `http://localhost:3000`

## 3) First login

Use an existing Supabase Auth user.

If needed, create one in Supabase dashboard under Authentication.

## 4) Important notes

- This is the foundation pass for the full parity roadmap.
- The backend currently initializes tables with `create_all` on startup.
- Next step should be Alembic migrations and expanded domain modules (email, tasks, opportunities, analytics, admin settings, communication hub).
