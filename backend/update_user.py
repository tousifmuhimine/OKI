import asyncio
from app.core.config import settings
import httpx

async def main():
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/a31c8d90-ab44-4001-a9ee-3a513156a6bd"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    
    body = {
        "user_metadata": {
            "name": "Tousif",
            "role": "admin"
        }
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.put(url, headers=headers, json=body)
        print(resp.status_code, resp.text)

asyncio.run(main())
