from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import AuthError, verify_supabase_token
from app.db.session import get_db_session


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


@dataclass
class AuthContext:
    user_id: str
    email: str | None = None
    role: str | None = None


async def get_current_auth(
    token: str | None = Depends(oauth2_scheme),
    dev_workspace_id: str | None = Header(default=None, alias="X-Dev-Workspace-Id"),
) -> AuthContext:
    if token:
        try:
            payload = await verify_supabase_token(token)
        except AuthError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=str(exc),
            ) from exc

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return AuthContext(
            user_id=user_id,
            email=payload.get("email"),
            role=payload.get("role"),
        )

    if settings.allow_anon_dev and settings.debug:
        return AuthContext(user_id=dev_workspace_id or "dev-user", email="dev@local")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )


def get_session_dep(session: AsyncSession = Depends(get_db_session)) -> AsyncSession:
    return session
