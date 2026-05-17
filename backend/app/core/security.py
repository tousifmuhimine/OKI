import httpx
from jose import JWTError, jwt

from app.core.config import settings


class AuthError(Exception):
    pass


def decode_supabase_token(token: str) -> dict:
    if not settings.supabase_jwt_secret:
        raise AuthError("SUPABASE_JWT_SECRET is not configured")

    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        # Extract org_id and role from app_metadata or user_metadata if available in the token
        org_id = payload.get("app_metadata", {}).get("org_id") or payload.get("user_metadata", {}).get("org_id")
        role = payload.get("user_metadata", {}).get("role") or payload.get("app_metadata", {}).get("role") or payload.get("role")
        payload["org_id"] = org_id
        payload["custom_role"] = role
        return payload
    except JWTError as exc:
        raise AuthError("Invalid auth token") from exc


async def verify_supabase_token(token: str) -> dict:
    try:
        return decode_supabase_token(token)
    except AuthError as local_error:
        if not settings.supabase_url or not settings.supabase_anon_key:
            raise local_error

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
                headers={
                    "apikey": settings.supabase_anon_key,
                    "Authorization": f"Bearer {token}",
                },
            )
    except httpx.HTTPError as exc:
        raise AuthError("Could not verify auth token") from exc

    if response.status_code != 200:
        raise AuthError("Invalid auth token")

    user = response.json()
    return {
        "sub": user.get("id"),
        "email": user.get("email"),
        "role": user.get("user_metadata", {}).get("role") or user.get("app_metadata", {}).get("role") or "authenticated",
        "custom_role": user.get("user_metadata", {}).get("role") or user.get("app_metadata", {}).get("role") or "authenticated",
        "org_id": user.get("user_metadata", {}).get("org_id") or user.get("app_metadata", {}).get("org_id")
    }
