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
        "role": "authenticated",
    }
