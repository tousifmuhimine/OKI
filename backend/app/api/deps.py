from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import AuthError, verify_supabase_token
from app.db.models import PermissionGrant
from app.db.session import get_db_session


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token", auto_error=False)


@dataclass
class AuthContext:
    user_id: str
    org_id: str | None = None
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

        org_id = payload.get("org_id")
        if not org_id and settings.allow_anon_dev and settings.debug:
            org_id = "dev-org"

        return AuthContext(
            user_id=user_id,
            org_id=org_id,
            email=payload.get("email"),
            role=payload.get("role"),
        )

    if settings.allow_anon_dev and settings.debug:
        return AuthContext(
            user_id=dev_workspace_id or "dev-user",
            org_id=dev_workspace_id or "dev-org",
            email="dev@local"
        )

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )


def get_session_dep(session: AsyncSession = Depends(get_db_session)) -> AsyncSession:
    return session


async def has_permission(session: AsyncSession, workspace_id: str, auth: AuthContext, permission_key: str) -> bool:
    if auth.role == "admin":
        return True

    from sqlalchemy import select

    query = select(PermissionGrant).where(
        PermissionGrant.workspace_id == workspace_id,
        PermissionGrant.user_id == auth.user_id,
        PermissionGrant.permission_key == permission_key,
    )
    result = await session.execute(query)
    grant = result.scalar_one_or_none()
    if grant is None:
        return False
    return bool(grant.is_allowed)


async def require_permission(permission_key: str, auth: AuthContext, session: AsyncSession) -> None:
    allowed = await has_permission(session, auth.user_id, auth, permission_key)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")
