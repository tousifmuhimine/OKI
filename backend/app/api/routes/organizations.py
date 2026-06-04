from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Organization

router = APIRouter()

class OrganizationOut(BaseModel):
    id: str
    company_name: str
    organization_type_code: str | None = None
    organization_type_name: str | None = None

class OrganizationUpdate(BaseModel):
    company_name: str | None = None
    organization_type_code: str | None = None

class OrganizationTypeOut(BaseModel):
    id: str
    name: str
    code: str

async def _backfill_org_data(session: AsyncSession, org_id: str) -> None:
    from app.db.models import Lead, Customer, Opportunity, SalesOrder, Inbox, Contact, Conversation, Message, Task, LeadActivity, LeadStage
    from sqlalchemy import update, select

    # Backfill organization_id (only for the dev-org to avoid claiming other data)
    if org_id == "dev-org":
        models_to_update = [Lead, Customer, Opportunity, SalesOrder, Inbox, Contact, Conversation, Message, Task, LeadActivity]
        for model in models_to_update:
            if hasattr(model, "organization_id"):
                await session.execute(
                    update(model).where(model.organization_id.is_(None)).values(organization_id=org_id)
                )

    # Resolve first stage for this organization to backfill unassigned leads
    first_stage = (await session.execute(
        select(LeadStage)
        .where(LeadStage.organization_id == org_id)
        .order_by(LeadStage.position.asc())
    )).scalars().first()

    if first_stage:
        await session.execute(
            update(Lead)
            .where(Lead.organization_id == org_id, Lead.lead_stage_id.is_(None))
            .values(lead_stage_id=first_stage.id, status=first_stage.name.lower().replace(" ", "_"))
        )
    await session.flush()


@router.get("/me", response_model=OrganizationOut)
async def get_my_organization(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> OrganizationOut:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")

    from app.db.models import OrganizationType
    from sqlalchemy import select
    from app.services.industry_seeder import seed_organization_defaults, seed_organization_types

    org = await session.get(Organization, auth.org_id)
    await seed_organization_types(session)

    if not org:
        is_dev = (auth.org_id == "dev-org")
        org_type_id = None
        if is_dev:
            default_type = (await session.execute(select(OrganizationType).where(OrganizationType.code == "study_abroad"))).scalar_one_or_none()
            org_type_id = default_type.id if default_type else None

        org = Organization(
            id=auth.org_id, 
            company_name="My Organization" if auth.org_id != "dev-org" else "Dev Org",
            organization_type_id=org_type_id
        )
        session.add(org)
        await session.flush()
        if is_dev and default_type:
            await seed_organization_defaults(session, org.id, default_type.code)
        
        await _backfill_org_data(session, org.id)
        await session.commit()
        await session.refresh(org)
    else:
        if not org.organization_type_id and auth.org_id == "dev-org":
            default_type = (await session.execute(select(OrganizationType).where(OrganizationType.code == "study_abroad"))).scalar_one_or_none()
            if default_type:
                org.organization_type_id = default_type.id
                await seed_organization_defaults(session, org.id, default_type.code)

        await _backfill_org_data(session, org.id)
        await session.commit()
        await session.refresh(org)

    type_code = None
    type_name = None
    if org.organization_type_id:
        org_type = await session.get(OrganizationType, org.organization_type_id)
        if org_type:
            type_code = org_type.code
            type_name = org_type.name

    return OrganizationOut(
        id=org.id,
        company_name=org.company_name,
        organization_type_code=type_code,
        organization_type_name=type_name,
    )

@router.patch("/me", response_model=OrganizationOut)
async def update_my_organization(
    payload: OrganizationUpdate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> OrganizationOut:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")

    org = await session.get(Organization, auth.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    from app.db.models import OrganizationType
    from sqlalchemy import select
    from app.services.industry_seeder import seed_organization_defaults

    if payload.company_name is not None:
        org.company_name = payload.company_name

    if payload.organization_type_code is not None:
        org_type = (await session.execute(
            select(OrganizationType).where(OrganizationType.code == payload.organization_type_code)
        )).scalar_one_or_none()
        if not org_type:
            raise HTTPException(status_code=400, detail="Invalid organization type code")
        org.organization_type_id = org_type.id
        await seed_organization_defaults(session, org.id, org_type.code)

    await session.commit()
    await session.refresh(org)

    type_code = None
    type_name = None
    if org.organization_type_id:
        org_type = await session.get(OrganizationType, org.organization_type_id)
        if org_type:
            type_code = org_type.code
            type_name = org_type.name

    return OrganizationOut(
        id=org.id,
        company_name=org.company_name,
        organization_type_code=type_code,
        organization_type_name=type_name,
    )

@router.get("/types", response_model=list[OrganizationTypeOut])
async def list_organization_types(
    session: AsyncSession = Depends(get_session_dep),
) -> list[OrganizationTypeOut]:
    from app.db.models import OrganizationType
    from sqlalchemy import select
    from app.services.industry_seeder import seed_organization_types
    
    await seed_organization_types(session)
    rows = (await session.execute(select(OrganizationType))).scalars().all()
    return [
        OrganizationTypeOut(id=r.id, name=r.name, code=r.code)
        for r in rows
    ]


class BranchOut(BaseModel):
    id: str
    organization_id: str
    name: str
    location: str | None = None

    class Config:
        from_attributes = True

class BranchCreate(BaseModel):
    name: str
    location: str | None = None

class UserOut(BaseModel):
    id: str
    organization_id: str | None = None
    branch_id: str | None = None
    email: str
    name: str | None = None
    role_id: str
    role_code: str | None = None
    reports_to_id: str | None = None
    permissions: list[str] = []
    task_count: int = 0
    lead_count: int = 0

    class Config:
        from_attributes = True


class UserUpdatePayload(BaseModel):
    name: str | None = None
    role_code: str | None = None
    branch_id: str | None = None
    reports_to_id: str | None = None


@router.get("/branches", response_model=list[BranchOut])
async def list_my_branches(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[BranchOut]:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")

    from app.db.models import Branch
    from sqlalchemy import select
    res = await session.execute(select(Branch).where(Branch.organization_id == auth.org_id))
    return list(res.scalars().all())


@router.post("/branches", response_model=BranchOut)
async def create_branch(
    payload: BranchCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> BranchOut:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")
    if auth.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only admins can create branches")

    from app.db.models import Branch
    branch = Branch(
        organization_id=auth.org_id,
        name=payload.name,
        location=payload.location,
    )
    session.add(branch)
    await session.commit()
    await session.refresh(branch)
    return branch


@router.get("/users/me", response_model=UserOut)
async def get_my_user_profile(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> UserOut:
    from app.db.models import User, Role, Task, Lead, PermissionGrant
    from sqlalchemy import select, func
    stmt = select(User, Role.code).outerjoin(Role, User.role_id == Role.id).where(User.id == auth.user_id)
    res = await session.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="User profile not found")
    
    user, role_code = row

    # Fetch stats
    task_stmt = select(func.count(Task.id)).where(Task.assigned_user_id == auth.user_id, Task.organization_id == auth.org_id)
    task_count = (await session.execute(task_stmt)).scalar() or 0

    lead_stmt = select(func.count(Lead.id)).where(
        ((Lead.assigned_user_id == auth.user_id) | (Lead.assigned_agent_id == auth.user_id)),
        Lead.organization_id == auth.org_id
    )
    lead_count = (await session.execute(lead_stmt)).scalar() or 0

    # Fetch permissions
    perm_stmt = select(PermissionGrant.permission_key).where(
        PermissionGrant.user_id == auth.user_id,
        PermissionGrant.is_allowed == True
    )
    perm_res = await session.execute(perm_stmt)
    permissions = list(perm_res.scalars().all())

    return UserOut(
        id=user.id,
        organization_id=user.organization_id,
        branch_id=user.branch_id,
        email=user.email,
        name=user.name,
        role_id=user.role_id,
        role_code=role_code,
        reports_to_id=user.reports_to_id,
        permissions=permissions,
        task_count=task_count,
        lead_count=lead_count
    )


@router.get("/users", response_model=list[UserOut])
async def list_org_users(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[UserOut]:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")

    from app.db.models import User, Role, Task, Lead, PermissionGrant
    from sqlalchemy import select, func
    stmt = select(User, Role.code).outerjoin(Role, User.role_id == Role.id).where(User.organization_id == auth.org_id)
    res = await session.execute(stmt)
    
    rows = res.all()
    org_user_ids = [u.id for u, _ in rows]

    # Fetch stats
    task_count_map = {}
    lead_count_map = {}
    perms_by_user = {}

    if org_user_ids:
        # Task counts
        task_counts = (
            await session.execute(
                select(Task.assigned_user_id, func.count(Task.id).label("cnt"))
                .where(Task.organization_id == auth.org_id, Task.assigned_user_id.in_(org_user_ids))
                .group_by(Task.assigned_user_id)
            )
        ).all()
        task_count_map = {row.assigned_user_id: row.cnt for row in task_counts if row.assigned_user_id}

        # Lead counts
        all_leads = (await session.execute(
            select(Lead).where(
                Lead.organization_id == auth.org_id,
                ((Lead.assigned_user_id.in_(org_user_ids)) | (Lead.assigned_agent_id.in_(org_user_ids)))
            )
        )).scalars().all()
        for lead in all_leads:
            if lead.assigned_user_id:
                lead_count_map[lead.assigned_user_id] = lead_count_map.get(lead.assigned_user_id, 0) + 1
            if lead.assigned_agent_id:
                lead_count_map[lead.assigned_agent_id] = lead_count_map.get(lead.assigned_agent_id, 0) + 1

        # Permissions
        perm_res = await session.execute(
            select(PermissionGrant).where(
                PermissionGrant.user_id.in_(org_user_ids),
                PermissionGrant.is_allowed == True
            )
        )
        for p in perm_res.scalars().all():
            perms_by_user.setdefault(p.user_id, []).append(p.permission_key)

    users_out = []
    for user, role_code in rows:
        users_out.append(UserOut(
            id=user.id,
            organization_id=user.organization_id,
            branch_id=user.branch_id,
            email=user.email,
            name=user.name,
            role_id=user.role_id,
            role_code=role_code,
            reports_to_id=user.reports_to_id,
            permissions=perms_by_user.get(user.id, []),
            task_count=task_count_map.get(user.id, 0),
            lead_count=lead_count_map.get(user.id, 0)
        ))
    return users_out


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_org_user(
    user_id: str,
    payload: UserUpdatePayload,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> UserOut:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")
    
    # Only super_admin can update users in their organization
    if auth.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only admins can update user profiles")
        
    from app.db.models import User, Role, Task, Lead, PermissionGrant
    from sqlalchemy import select, func
    
    # Find user in the organization
    stmt = select(User).where(User.id == user_id, User.organization_id == auth.org_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in organization")
        
    if payload.name is not None:
        user.name = payload.name
        
    if payload.role_code is not None:
        # Check if role exists or create it
        role_stmt = select(Role).where(Role.code == payload.role_code)
        role_res = await session.execute(role_stmt)
        role = role_res.scalar_one_or_none()
        if not role:
            role = Role(name=payload.role_code.replace("_", " ").title(), code=payload.role_code)
            session.add(role)
            await session.flush()
        user.role_id = role.id
        
    if payload.branch_id is not None:
        if payload.branch_id:
            from app.db.models import Branch
            branch_stmt = select(Branch).where(Branch.id == payload.branch_id, Branch.organization_id == auth.org_id)
            branch_res = await session.execute(branch_stmt)
            if not branch_res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Invalid branch ID")
            user.branch_id = payload.branch_id
        else:
            user.branch_id = None
            
    if payload.reports_to_id is not None:
        if payload.reports_to_id:
            if payload.reports_to_id == user_id:
                raise HTTPException(status_code=400, detail="User cannot report to themselves")
            # Verify reports_to user is in the same organization
            reports_to_stmt = select(User).where(User.id == payload.reports_to_id, User.organization_id == auth.org_id)
            reports_to_res = await session.execute(reports_to_stmt)
            if not reports_to_res.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Invalid reports_to_id: User not found in this organization")
            user.reports_to_id = payload.reports_to_id
        else:
            user.reports_to_id = None
            
    await session.commit()
    
    # Reload role code and stats
    stmt = select(User, Role.code).outerjoin(Role, User.role_id == Role.id).where(User.id == user_id)
    res = await session.execute(stmt)
    row = res.first()
    user, role_code = row
    
    task_stmt = select(func.count(Task.id)).where(Task.assigned_user_id == user.id, Task.organization_id == auth.org_id)
    task_count = (await session.execute(task_stmt)).scalar() or 0

    lead_stmt = select(func.count(Lead.id)).where(
        ((Lead.assigned_user_id == user.id) | (Lead.assigned_agent_id == user.id)),
        Lead.organization_id == auth.org_id
    )
    lead_count = (await session.execute(lead_stmt)).scalar() or 0

    perm_stmt = select(PermissionGrant.permission_key).where(
        PermissionGrant.user_id == user.id,
        PermissionGrant.is_allowed == True
    )
    perm_res = await session.execute(perm_stmt)
    permissions = list(perm_res.scalars().all())

    return UserOut(
        id=user.id,
        organization_id=user.organization_id,
        branch_id=user.branch_id,
        email=user.email,
        name=user.name,
        role_id=user.role_id,
        role_code=role_code,
        reports_to_id=user.reports_to_id,
        permissions=permissions,
        task_count=task_count,
        lead_count=lead_count
    )


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization_user(
    user_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")
    
    # Only super_admin can delete users (no admin role exists anymore)
    if auth.role != "super_admin":
        raise HTTPException(status_code=403, detail="Only the super admin can delete team members")
        
    if user_id == auth.user_id:
        raise HTTPException(status_code=400, detail="Super admin cannot delete themselves")
        
    from app.db.models import User, PermissionGrant
    from sqlalchemy import select, delete
    
    # Find user in the organization
    stmt = select(User).where(User.id == user_id, User.organization_id == auth.org_id)
    res = await session.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in organization")
        
    # Delete from Supabase auth first
    from app.core.config import settings
    import httpx
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.delete(
                f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user_id}",
                headers={
                    "apikey": settings.supabase_service_role_key,
                    "Authorization": f"Bearer {settings.supabase_service_role_key}",
                },
            )
            # If user does not exist in Supabase (e.g. deleted/mocked), we continue
            if resp.status_code not in (200, 404):
                print(f"Supabase auth delete returned status {resp.status_code}: {resp.text}")
    except Exception as exc:
        print(f"Failed to delete user from Supabase auth: {exc}")
        
    # Delete user's PermissionGrant rows
    await session.execute(delete(PermissionGrant).where(PermissionGrant.user_id == user_id))
    
    # Delete local User row
    await session.delete(user)
    await session.commit()



