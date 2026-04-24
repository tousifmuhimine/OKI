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
