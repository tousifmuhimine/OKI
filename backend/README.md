# Backend (FastAPI + Supabase)

This backend provides the first implementation pass for the CRM foundation:
- Supabase JWT auth validation
- Core CRM entities (customers, leads, products, orders)
- Dashboard summary API

## 1. Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Fill `.env` with your Supabase values.

## 2. Run

```bash
uvicorn app.main:app --reload --port 8000
```

## 3. API docs

- OpenAPI UI: `http://localhost:8000/docs`
- OpenAPI JSON: `http://localhost:8000/openapi.json`

## 4. Notes

- This is a strong foundation, not final parity.
- Table creation currently uses `create_all` on startup for fast iteration.
- For production, add Alembic migrations and stricter deployment controls.
