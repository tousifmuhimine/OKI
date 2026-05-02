from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Task
from app.schemas.common import PaginationMeta
from app.schemas.task import TaskCreate, TaskListResponse, TaskOut, TaskUpdate

router = APIRouter()


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    entity_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    month: str | None = Query(default=None, description="YYYY-MM — filter by due_date month"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> TaskListResponse:
    filters = []

    if entity_type:
        filters.append(Task.entity_type == entity_type)
    if status_filter:
        filters.append(Task.status == status_filter)
    if month:
        # Parse "YYYY-MM" → filter due_date within that month
        try:
            year, mon = int(month.split("-")[0]), int(month.split("-")[1])
            # Start = first day of month, end = first day of next month
            start = datetime(year, mon, 1)
            end = datetime(year + (mon == 12), (mon % 12) + 1, 1) if mon < 12 else datetime(year + 1, 1, 1)
            filters.append(and_(Task.due_date >= start, Task.due_date < end))
        except (ValueError, IndexError):
            pass  # ignore bad month param

    query = select(Task)
    count_query = select(func.count(Task.id))

    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    query = query.order_by(Task.due_date.asc().nullslast(), Task.created_at.asc()).limit(limit).offset(offset)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return TaskListResponse(
        data=[TaskOut.model_validate(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> TaskOut:
    task = Task(**payload.model_dump())
    if not task.assigned_user_id:
        task.assigned_user_id = auth.user_id
    session.add(task)
    await session.commit()
    await session.refresh(task)
    return TaskOut.model_validate(task)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    task_id: str,
    payload: TaskUpdate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> TaskOut:
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(task, key, value)
    await session.commit()
    await session.refresh(task)
    return TaskOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    task = await session.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    await session.delete(task)
    await session.commit()
