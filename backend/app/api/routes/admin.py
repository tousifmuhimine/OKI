from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, status
import httpx

from app.api.deps import AuthContext, get_current_auth, get_session_dep, has_permission
from app.core.config import settings


router = APIRouter()


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=32)


class AdminUserOut(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    payload: AdminUserCreate,
    auth: AuthContext = Depends(get_current_auth),
    session=Depends(get_session_dep),
) -> AdminUserOut:
    if not await has_permission(session, auth.user_id, auth.user_id, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase admin credentials are not configured")

    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    body = {
        "email": payload.email,
        "password": payload.password,
        "email_confirm": True,
        "user_metadata": {
            "name": payload.full_name,
            "role": payload.role,
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, headers=headers, json=body)

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    return AdminUserOut(
        id=str(data.get("id") or data.get("user", {}).get("id")),
        email=data.get("email") or data.get("user", {}).get("email"),
        role=payload.role,
    )
