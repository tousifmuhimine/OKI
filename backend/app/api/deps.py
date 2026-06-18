from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status, Query
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
    branch_id: str | None = None


async def _ensure_organization_initialized(
    session: AsyncSession,
    org_id: str,
    company_name: str | None = None,
    org_type_code: str | None = None,
) -> None:
    from app.db.models import Organization, OrganizationType
    from sqlalchemy import select
    from app.services.industry_seeder import seed_organization_defaults, seed_organization_types
    from app.api.routes.organizations import _backfill_org_data

    org = await session.get(Organization, org_id)
    await seed_organization_types(session)

    if not org:
        is_dev = (org_id == "dev-org")
        org_type_id = None
        default_type = None
        
        resolved_type_code = org_type_code or ("study_abroad" if is_dev else None)
        if resolved_type_code:
            default_type = (await session.execute(
                select(OrganizationType).where(OrganizationType.code == resolved_type_code)
            )).scalar_one_or_none()
            org_type_id = default_type.id if default_type else None

        default_company_name = company_name or ("Dev Org" if is_dev else "My Organization")

        org = Organization(
            id=org_id,
            company_name=default_company_name,
            organization_type_id=org_type_id
        )
        session.add(org)
        await session.flush()
        if default_type:
            await seed_organization_defaults(session, org.id, default_type.code)
        await _backfill_org_data(session, org.id)
        await session.commit()
    else:
        dirty = False
        if not org.organization_type_id:
            resolved_type_code = org_type_code or ("study_abroad" if org_id == "dev-org" else None)
            if resolved_type_code:
                default_type = (await session.execute(
                    select(OrganizationType).where(OrganizationType.code == resolved_type_code)
                )).scalar_one_or_none()
                if default_type:
                    org.organization_type_id = default_type.id
                    await seed_organization_defaults(session, org.id, default_type.code)
                    dirty = True
        if (org.company_name == "My Organization" or org.company_name == "Dev Org") and company_name:
            org.company_name = company_name
            dirty = True
        if dirty or org_id == "dev-org":
            await _backfill_org_data(session, org.id)
            await session.commit()


async def get_current_auth(
    token: str | None = Depends(oauth2_scheme),
    access_token: str | None = Query(default=None, alias="access_token"),
    dev_workspace_id: str | None = Header(default=None, alias="X-Dev-Workspace-Id"),
    session: AsyncSession = Depends(get_db_session),
) -> AuthContext:
    resolved_token = token or access_token
    if resolved_token:
        try:
            payload = await verify_supabase_token(resolved_token)
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

        # Query local database user details
        from app.db.models import User, Role
        from sqlalchemy import select
        local_user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()

        role = None
        branch_id = None
        local_org_id = None
        if local_user:
            role = (await session.execute(select(Role.code).where(Role.id == local_user.role_id))).scalar_one_or_none()
            branch_id = local_user.branch_id
            local_org_id = local_user.organization_id
        else:
            role_code = payload.get("custom_role") or payload.get("role") or "super_admin"
            if role_code in ("authenticated", "anon"):
                role_code = "super_admin"
            
            role_codes = ["super_admin", "branch_admin", "individual_agent", "employee"]
            for rc in role_codes:
                exists = (await session.execute(select(Role).where(Role.code == rc))).scalar_one_or_none()
                if not exists:
                    session.add(Role(name=rc.replace("_", " ").title(), code=rc))
            await session.flush()
            
            role_obj = (await session.execute(select(Role).where(Role.code == role_code))).scalar_one_or_none()
            if not role_obj:
                role_obj = Role(name=role_code.replace("_", " ").title(), code=role_code)
                session.add(role_obj)
                await session.flush()
            
            resolved_org_id = org_id or payload.get("org_id")
            if not resolved_org_id:
                import uuid
                resolved_org_id = str(uuid.uuid4())
                
            user_meta = payload.get("user_metadata", {})
            meta_company_name = user_meta.get("company_name")
            meta_org_type_code = user_meta.get("org_type_code")
            await _ensure_organization_initialized(
                session,
                resolved_org_id,
                company_name=meta_company_name,
                org_type_code=meta_org_type_code
            )

            local_user = User(
                id=user_id,
                organization_id=resolved_org_id,
                email=payload.get("email") or "user@domain.com",
                role_id=role_obj.id,
                name=payload.get("user_metadata", {}).get("name") or payload.get("name")
            )
            session.add(local_user)
            await session.commit()
            
            role = role_code
            branch_id = None
            local_org_id = resolved_org_id

        resolved_org_id = local_org_id or org_id
        if resolved_org_id:
            user_meta = payload.get("user_metadata", {})
            meta_company_name = user_meta.get("company_name")
            meta_org_type_code = user_meta.get("org_type_code")
            await _ensure_organization_initialized(
                session,
                resolved_org_id,
                company_name=meta_company_name,
                org_type_code=meta_org_type_code
            )

        return AuthContext(
            user_id=user_id,
            org_id=resolved_org_id,
            email=payload.get("email"),
            role=role,
            branch_id=branch_id,
        )

    if settings.allow_anon_dev and settings.debug:
        user_id = dev_workspace_id or "dev-user"
        from app.db.models import User, Role, Organization
        from sqlalchemy import select
        
        # Ensure a dev organization exists
        org_id = dev_workspace_id or "dev-org"
        await _ensure_organization_initialized(session, org_id)
        
        # Ensure Roles exist
        role_codes = ["super_admin", "branch_admin", "individual_agent", "employee"]
        for rc in role_codes:
            exists = (await session.execute(select(Role).where(Role.code == rc))).scalar_one_or_none()
            if not exists:
                session.add(Role(name=rc.replace("_", " ").title(), code=rc))
        await session.flush()

        local_user = (await session.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if not local_user:
            sa_role = (await session.execute(select(Role).where(Role.code == "super_admin"))).scalar_one()
            local_user = User(
                id=user_id,
                organization_id=org_id,
                email="dev@local",
                role_id=sa_role.id
            )
            session.add(local_user)
            await session.commit()
            role_code = "super_admin"
            branch_id = None
            local_org_id = org_id
        else:
            role_code = (await session.execute(select(Role.code).where(Role.id == local_user.role_id))).scalar_one_or_none() or "super_admin"
            branch_id = local_user.branch_id
            local_org_id = local_user.organization_id

        return AuthContext(
            user_id=user_id,
            org_id=local_org_id,
            email="dev@local",
            role=role_code,
            branch_id=branch_id,
        )

    if not resolved_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )


def get_session_dep(session: AsyncSession = Depends(get_db_session)) -> AsyncSession:
    return session


async def has_permission(session: AsyncSession, workspace_id: str, auth: AuthContext, permission_key: str) -> bool:
    if auth.role == "super_admin" or auth.role == "admin":
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


def apply_tenant_filters(query, auth: AuthContext, model_class):
    """
    Applies strict tenant and role-based filtering to an SQLAlchemy query.
    """
    from sqlalchemy import or_, select
    has_org_id = hasattr(model_class, "organization_id")
    has_branch_id = hasattr(model_class, "branch_id")
    has_assigned_user = hasattr(model_class, "assigned_user_id")

    conditions = []
    
    if has_org_id and auth.org_id:
        conditions.append(model_class.organization_id == auth.org_id)
        
    if auth.role == "super_admin" or auth.role == "admin":
        # Can see everything in the organization
        pass
    elif auth.role == "branch_admin":
        if has_branch_id and auth.branch_id:
            conditions.append(model_class.branch_id == auth.branch_id)
    elif auth.role == "individual_agent":
        if has_assigned_user:
            from app.db.models import User
            sub_users = select(User.id).where(User.reports_to_id == auth.user_id)
            agent_conds = [
                model_class.assigned_user_id == auth.user_id,
                model_class.assigned_user_id.in_(sub_users)
            ]
            if hasattr(model_class, "assigned_agent_id"):
                agent_conds.append(model_class.assigned_agent_id == auth.user_id)
                agent_conds.append(model_class.assigned_agent_id.in_(sub_users))
            conditions.append(or_(*agent_conds))
    elif auth.role == "employee":
        if has_assigned_user:
            from app.db.models import Assignment
            employee_conds = [model_class.assigned_user_id == auth.user_id]
            if hasattr(model_class, "assigned_agent_id"):
                employee_conds.append(model_class.assigned_agent_id == auth.user_id)
            
            lead_sub = select(Assignment.lead_id).where(Assignment.user_id == auth.user_id, Assignment.lead_id.is_not(None))
            cust_sub = select(Assignment.customer_id).where(Assignment.user_id == auth.user_id, Assignment.customer_id.is_not(None))
            
            employee_conds.append(model_class.id.in_(lead_sub))
            employee_conds.append(model_class.id.in_(cust_sub))
            conditions.append(or_(*employee_conds))

    if conditions:
        query = query.where(*conditions)
        
    return query


async def verify_crm_enabled(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_db_session),
) -> None:
    if auth.role == "super_admin":
        return
    if not auth.org_id:
        return
        
    from app.db.models import Organization
    org = await session.get(Organization, auth.org_id)
    if org and not org.crm_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CRM access is disabled for your organization. Please verify your subscription status.",
        )
