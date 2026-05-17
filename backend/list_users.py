import asyncio
from app.core.config import settings
import httpx

async def main():
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers)
        users = resp.json().get("users", [])
        for u in users:
            meta = u.get("user_metadata", {})
            print(f"User: {u.get('email')} | Name: {meta.get('name')} | Role: {meta.get('role')} | ID: {u.get('id')}")

asyncio.run(main())
