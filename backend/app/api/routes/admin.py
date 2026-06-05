from pydantic import BaseModel, EmailStr, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone, timedelta

from app.api.deps import AuthContext, get_current_auth, get_session_dep, has_permission
from app.core.config import settings
from app.db.models import Lead, PermissionGrant, Task


router = APIRouter()


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    role: str | None = Field(default=None, max_length=32)
    branch_id: str | None = Field(default=None, max_length=36)


class AdminUserOut(BaseModel):
    id: str
    email: str | None = None
    role: str | None = None


class AdminUserDetail(BaseModel):
    id: str
    email: str | None = None
    name: str | None = None
    role: str | None = None
    created_at: str | None = None
    permissions: list[str] = []
    task_count: int = 0
    lead_count: int = 0
    branch_id: str | None = None


class AdminUserListResponse(BaseModel):
    data: list[AdminUserDetail]
    total: int = 0


class PermissionsSummaryItem(BaseModel):
    user_id: str
    permissions: list[str] = []


class TasksSummaryItem(BaseModel):
    assigned_user_id: str
    count: int = 0
    pending: int = 0
    done: int = 0


@router.post("/users", response_model=AdminUserOut, status_code=status.HTTP_201_CREATED)
async def create_admin_user(
    payload: AdminUserCreate,
    auth: AuthContext = Depends(get_current_auth),
    session=Depends(get_session_dep),
) -> AdminUserOut:
    if auth.role != "super_admin" and auth.role != "branch_admin" and not await has_permission(session, auth.user_id, auth, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")

    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(status_code=500, detail="Supabase admin credentials are not configured")

    role_to_use = payload.role or "employee"
    if auth.role == "branch_admin":
        if role_to_use not in ("employee", "individual_agent"):
            role_to_use = "employee"
        resolved_branch_id = auth.branch_id
    else:
        resolved_branch_id = payload.branch_id

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
            "role": role_to_use,
        },
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(url, headers=headers, json=body)

    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    user_data = data.get("user") or data
    new_user_id = str(user_data.get("id"))
    
    # Create local DB user immediately
    from app.db.models import User, Role
    
    role_stmt = select(Role).where(Role.code == role_to_use)
    role_res = await session.execute(role_stmt)
    role_obj = role_res.scalar_one_or_none()
    if not role_obj:
        role_obj = Role(name=role_to_use.replace("_", " ").title(), code=role_to_use)
        session.add(role_obj)
        await session.flush()
        
    local_user = User(
        id=new_user_id,
        organization_id=auth.org_id,
        branch_id=resolved_branch_id,
        email=payload.email,
        role_id=role_obj.id,
        name=payload.full_name,
    )
    session.add(local_user)
    await session.commit()

    return AdminUserOut(
        id=new_user_id,
        email=payload.email,
        role=role_to_use,
    )



@router.get("/users", response_model=AdminUserListResponse)
async def list_admin_users(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> AdminUserListResponse:
    if auth.role not in ("super_admin", "branch_admin") and not await has_permission(session, auth.user_id, auth, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")
    """List users from Supabase Auth and enrich with permissions + task counts."""
    # Agents need to view users for lead assignment, no permission required.

    from app.db.models import User
    # Define local user filter based on role scope
    user_stmt = select(User.id).where(User.organization_id == auth.org_id)
    if auth.role == "branch_admin":
        user_stmt = user_stmt.where(User.branch_id == auth.branch_id)
    elif auth.role == "individual_agent":
        user_stmt = user_stmt.where((User.reports_to_id == auth.user_id) | (User.id == auth.user_id))
    elif auth.role == "employee":
        user_stmt = user_stmt.where(User.id == auth.user_id)
        
    local_user_ids = (await session.execute(user_stmt)).scalars().all()
    local_user_ids_set = set(local_user_ids)

    # Fetch from Supabase Admin API
    users: list[AdminUserDetail] = []
    if settings.supabase_url and settings.supabase_service_role_key:
        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code < 400:
                supa_users = resp.json().get("users", [])
                for u in supa_users:
                    meta = u.get("user_metadata") or {}
                    uid = u.get("id", "")
                    if uid in local_user_ids_set:
                        users.append(AdminUserDetail(
                            id=uid,
                            email=u.get("email"),
                            name=meta.get("name"),
                            role=meta.get("role"),
                            created_at=u.get("created_at"),
                        ))
        except Exception:
            pass  # fallback to empty

    # Get all permission grants for workspace
    perm_rows = (
        await session.execute(
            select(PermissionGrant).where(
                PermissionGrant.workspace_id == auth.user_id,
                PermissionGrant.is_allowed == True,
                PermissionGrant.user_id.in_(local_user_ids)
            )
        )
    ).scalars().all()

    # Group permissions by user_id
    perms_by_user: dict[str, list[str]] = {}
    for p in perm_rows:
        perms_by_user.setdefault(p.user_id, []).append(p.permission_key)

    # Get task counts by assigned_user_id
    task_counts = (
        await session.execute(
            select(Task.assigned_user_id, func.count(Task.id).label("cnt"))
            .where(Task.assigned_user_id.in_(local_user_ids))
            .group_by(Task.assigned_user_id)
        )
    ).all()
    task_count_map: dict[str, int] = {row.assigned_user_id: row.cnt for row in task_counts if row.assigned_user_id}

    # Get lead counts by assignee, including either direct owner or assigned agent
    lead_count_map: dict[str, int] = {}
    all_leads = (await session.execute(
        select(Lead).where(
            or_(
                Lead.assigned_user_id.in_(local_user_ids),
                Lead.assigned_agent_id.in_(local_user_ids)
            )
        )
    )).scalars().all()
    for lead in all_leads:
        if lead.assigned_user_id and lead.assigned_user_id in local_user_ids_set:
            lead_count_map[lead.assigned_user_id] = lead_count_map.get(lead.assigned_user_id, 0) + 1
        if lead.assigned_agent_id and lead.assigned_agent_id in local_user_ids_set:
            lead_count_map[lead.assigned_agent_id] = lead_count_map.get(lead.assigned_agent_id, 0) + 1

    # Enrich users with permissions + task counts
    for user in users:
        user.permissions = perms_by_user.get(user.id, [])
        user.task_count = task_count_map.get(user.id, 0)
        user.lead_count = lead_count_map.get(user.id, 0)

    # Also include any permission users not returned by Supabase (e.g. dev users)
    known_ids = {u.id for u in users}
    for p in perm_rows:
        if p.user_id not in known_ids and p.user_id in local_user_ids_set:
            users.append(AdminUserDetail(
                id=p.user_id,
                email=None,
                name=p.user_id[:12],
                permissions=perms_by_user.get(p.user_id, []),
                task_count=task_count_map.get(p.user_id, 0),
                lead_count=lead_count_map.get(p.user_id, 0),
            ))
            known_ids.add(p.user_id)

    return AdminUserListResponse(data=users, total=len(users))


@router.get("/users/permissions-summary", response_model=list[PermissionsSummaryItem])
async def permissions_summary(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[PermissionsSummaryItem]:
    if auth.role not in ("super_admin", "branch_admin") and not await has_permission(session, auth.user_id, auth, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")
    """Return each user and their list of permission grants for the workspace."""
    
    from app.db.models import User
    # Scope check
    user_stmt = select(User.id).where(User.organization_id == auth.org_id)
    if auth.role == "branch_admin":
        user_stmt = user_stmt.where(User.branch_id == auth.branch_id)
    elif auth.role == "individual_agent":
        user_stmt = user_stmt.where((User.reports_to_id == auth.user_id) | (User.id == auth.user_id))
    elif auth.role == "employee":
        user_stmt = user_stmt.where(User.id == auth.user_id)
        
    local_user_ids = (await session.execute(user_stmt)).scalars().all()

    if not local_user_ids:
        return []

    rows = (
        await session.execute(
            select(PermissionGrant).where(
                PermissionGrant.workspace_id == auth.user_id,
                PermissionGrant.is_allowed == True,
                PermissionGrant.user_id.in_(local_user_ids)
            )
        )
    ).scalars().all()

    grouped: dict[str, list[str]] = {}
    for r in rows:
        grouped.setdefault(r.user_id, []).append(r.permission_key)

    return [PermissionsSummaryItem(user_id=uid, permissions=perms) for uid, perms in grouped.items()]


@router.get("/users/tasks-summary", response_model=list[TasksSummaryItem])
async def tasks_summary(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[TasksSummaryItem]:
    if auth.role not in ("super_admin", "branch_admin") and not await has_permission(session, auth.user_id, auth, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")
    """Return task counts per assigned user."""
    
    from app.db.models import User
    # Scope check
    user_stmt = select(User.id).where(User.organization_id == auth.org_id)
    if auth.role == "branch_admin":
        user_stmt = user_stmt.where(User.branch_id == auth.branch_id)
    elif auth.role == "individual_agent":
        user_stmt = user_stmt.where((User.reports_to_id == auth.user_id) | (User.id == auth.user_id))
    elif auth.role == "employee":
        user_stmt = user_stmt.where(User.id == auth.user_id)
        
    local_user_ids = (await session.execute(user_stmt)).scalars().all()

    if not local_user_ids:
        return []

    all_tasks = (await session.execute(
        select(Task).where(Task.assigned_user_id.in_(local_user_ids))
    )).scalars().all()
    from collections import defaultdict
    count_map: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "pending": 0, "done": 0})
    for t in all_tasks:
        if not t.assigned_user_id:
            continue
        count_map[t.assigned_user_id]["count"] += 1
        if t.status == "done":
            count_map[t.assigned_user_id]["done"] += 1
        elif t.status == "pending":
            count_map[t.assigned_user_id]["pending"] += 1

    return [
        TasksSummaryItem(
            assigned_user_id=uid,
            count=v["count"],
            pending=v["pending"],
            done=v["done"],
        )
        for uid, v in count_map.items()
    ]


class DailyStat(BaseModel):
    date: str
    assigned: int
    did: int
    missed: int


class SynergyEmployeeDetail(BaseModel):
    id: str
    name: str | None = None
    email: str | None = None
    role: str | None = None
    assigned_count: int = 0
    touched_count: int = 0
    untouched_count: int = 0
    missed_count: int = 0
    activities_count: int = 0
    daily_stats: list[DailyStat] = []


class SynergySummary(BaseModel):
    total_assigned: int = 0
    total_touched: int = 0
    total_untouched: int = 0
    total_missed: int = 0


class SynergyReportResponse(BaseModel):
    summary: SynergySummary
    employees: list[SynergyEmployeeDetail]


@router.get("/synergy-report", response_model=SynergyReportResponse)
async def synergy_report(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> SynergyReportResponse:
    if auth.role not in ("super_admin", "branch_admin", "individual_agent", "employee") and not await has_permission(session, auth.user_id, auth, "permissions.manage"):
        raise HTTPException(status_code=403, detail="Permission denied")

    from app.db.models import User, Role, Lead, Assignment, LeadActivity, CommunicationLog, LeadStageHistory
    
    # 1. Fetch visible users
    stmt = select(User, Role.code).outerjoin(Role, User.role_id == Role.id).where(User.organization_id == auth.org_id)
    if auth.role == "branch_admin":
        stmt = stmt.where(User.branch_id == auth.branch_id)
    elif auth.role == "individual_agent":
        stmt = stmt.where((User.reports_to_id == auth.user_id) | (User.id == auth.user_id))
    elif auth.role == "employee":
        stmt = stmt.where(User.id == auth.user_id)
        
    res = await session.execute(stmt)
    user_rows = res.all()
    
    if not user_rows:
        return SynergyReportResponse(
            summary=SynergySummary(),
            employees=[]
        )
        
    user_ids = [u.id for u, _ in user_rows]
    user_map = {u.id: (u, rc) for u, rc in user_rows}

    # 2. Fetch all lead assignments for these users
    assign_stmt = select(Assignment.lead_id, Assignment.user_id).where(Assignment.user_id.in_(user_ids))
    assign_res = await session.execute(assign_stmt)
    assign_rows = assign_res.all()
    
    # Map lead_id -> set of assigned user_ids
    lead_assignments: dict[str, set[str]] = {}
    for lead_id, uid in assign_rows:
        lead_assignments.setdefault(lead_id, set()).add(uid)

    # 3. Query all leads assigned to visible users
    lead_ids_from_assignments = list(lead_assignments.keys())
    lead_stmt = select(Lead).where(
        or_(
            Lead.assigned_user_id.in_(user_ids),
            Lead.assigned_agent_id.in_(user_ids),
            Lead.id.in_(lead_ids_from_assignments) if lead_ids_from_assignments else False
        )
    )
    if auth.role == "branch_admin":
        lead_stmt = lead_stmt.where(Lead.branch_id == auth.branch_id)
        
    lead_res = await session.execute(lead_stmt)
    leads = lead_res.scalars().all()

    # 4. Fetch activity and comm logs for last 7 days to calculate 'did'
    now = datetime.now(timezone.utc)
    seven_days_ago = now - timedelta(days=7)
    
    activity_stmt = select(LeadActivity).where(
        LeadActivity.created_by_user_id.in_(user_ids),
        LeadActivity.created_at >= seven_days_ago
    )
    activity_res = await session.execute(activity_stmt)
    activities = activity_res.scalars().all()
    
    comm_stmt = select(CommunicationLog).where(
        CommunicationLog.logged_by_id.in_(user_ids),
        CommunicationLog.created_at >= seven_days_ago
    )
    comm_res = await session.execute(comm_stmt)
    comms = comm_res.scalars().all()

    history_stmt = select(LeadStageHistory).where(
        LeadStageHistory.changed_by_user_id.in_(user_ids),
        LeadStageHistory.created_at >= seven_days_ago
    )
    history_res = await session.execute(history_stmt)
    histories = history_res.scalars().all()

    # 5. Initialize structures for results
    date_list = [(now - timedelta(days=i)).date() for i in range(7)]
    date_list.reverse()  # oldest to newest (today last)
    
    employee_details: dict[str, dict] = {}
    for uid in user_ids:
        u_obj, role_code = user_map[uid]
        employee_details[uid] = {
            "id": uid,
            "name": u_obj.name,
            "email": u_obj.email,
            "role": role_code,
            "assigned_count": 0,
            "touched_count": 0,
            "untouched_count": 0,
            "missed_count": 0,
            "activities_count": 0,
            "daily_stats": {d: {"assigned": 0, "did": 0, "missed": 0} for d in date_list}
        }

    # 6. Populate 'did' daily stats
    for act in activities:
        uid = act.created_by_user_id
        if uid in employee_details:
            employee_details[uid]["activities_count"] += 1
            act_date = act.created_at.date() if act.created_at else None
            if act_date in employee_details[uid]["daily_stats"]:
                employee_details[uid]["daily_stats"][act_date]["did"] += 1
                
    for cm in comms:
        uid = cm.logged_by_id
        if uid in employee_details:
            employee_details[uid]["activities_count"] += 1
            cm_date = cm.created_at.date() if cm.created_at else None
            if cm_date in employee_details[uid]["daily_stats"]:
                employee_details[uid]["daily_stats"][cm_date]["did"] += 1

    for hist in histories:
        uid = hist.changed_by_user_id
        if uid in employee_details:
            hist_date = hist.created_at.date() if hist.created_at else None
            if hist_date in employee_details[uid]["daily_stats"]:
                employee_details[uid]["daily_stats"][hist_date]["did"] += 1

    # 7. Process leads metrics
    total_assigned_set = set()
    total_touched_set = set()
    total_untouched_set = set()
    total_missed_set = set()

    for l in leads:
        # Determine who this lead is assigned to
        assigned_to_uids = set()
        if l.assigned_user_id:
            assigned_to_uids.add(l.assigned_user_id)
        if l.assigned_agent_id:
            assigned_to_uids.add(l.assigned_agent_id)
        assigned_to_uids.update(lead_assignments.get(l.id, set()))
        # Intersect with visible user_ids
        assigned_to_uids = assigned_to_uids.intersection(user_ids)
        
        if not assigned_to_uids:
            continue

        # Check SLAs
        is_touch_missed = False
        if l.untouched and l.assigned_at and l.sla_duration_hours:
            deadline = l.assigned_at + timedelta(hours=l.sla_duration_hours)
            if deadline < now:
                is_touch_missed = True

        is_stage_missed = False
        if l.target_stage_by:
            if l.target_stage_by < now and l.lead_stage_id != l.target_stage_id:
                is_stage_missed = True

        is_missed = is_touch_missed or is_stage_missed

        # Aggregate to summary
        total_assigned_set.add(l.id)
        if l.untouched:
            total_untouched_set.add(l.id)
        else:
            total_touched_set.add(l.id)
        if is_missed:
            total_missed_set.add(l.id)

        # Aggregate per employee
        for uid in assigned_to_uids:
            emp = employee_details[uid]
            emp["assigned_count"] += 1
            if l.untouched:
                emp["untouched_count"] += 1
            else:
                emp["touched_count"] += 1
            if is_missed:
                emp["missed_count"] += 1

            # Daily stats for assignments
            if l.assigned_at:
                assign_date = l.assigned_at.date()
                if assign_date in emp["daily_stats"]:
                    emp["daily_stats"][assign_date]["assigned"] += 1

            # Daily stats for missed deadlines
            if is_touch_missed and l.assigned_at and l.sla_duration_hours:
                deadline_date = (l.assigned_at + timedelta(hours=l.sla_duration_hours)).date()
                if deadline_date in emp["daily_stats"]:
                    emp["daily_stats"][deadline_date]["missed"] += 1
            if is_stage_missed and l.target_stage_by:
                deadline_date = l.target_stage_by.date()
                if deadline_date in emp["daily_stats"]:
                    emp["daily_stats"][deadline_date]["missed"] += 1

    # 8. Format the final output
    formatted_employees = []
    for uid in user_ids:
        emp = employee_details[uid]
        daily_list = [
            DailyStat(
                date=d.isoformat(),
                assigned=stats["assigned"],
                did=stats["did"],
                missed=stats["missed"]
            )
            for d, stats in emp["daily_stats"].items()
        ]
        formatted_employees.append(
            SynergyEmployeeDetail(
                id=emp["id"],
                name=emp["name"],
                email=emp["email"],
                role=emp["role"],
                assigned_count=emp["assigned_count"],
                touched_count=emp["touched_count"],
                untouched_count=emp["untouched_count"],
                missed_count=emp["missed_count"],
                activities_count=emp["activities_count"],
                daily_stats=daily_list
            )
        )

    summary = SynergySummary(
        total_assigned=len(total_assigned_set),
        total_touched=len(total_touched_set),
        total_untouched=len(total_untouched_set),
        total_missed=len(total_missed_set)
    )

    return SynergyReportResponse(
        summary=summary,
        employees=formatted_employees
    )