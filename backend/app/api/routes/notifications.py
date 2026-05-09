"""Notification API routes — list, mark as read, unread count, and WebSocket push."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.core.config import settings
from app.core.security import AuthError, verify_supabase_token
from app.db.models import AlertNotification
from app.schemas.common import PaginationMeta
from app.schemas.notification import NotificationListResponse, NotificationOut, UnreadCountResponse

router = APIRouter()


def _notif_out(row: AlertNotification) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        workspace_id=row.workspace_id,
        title=row.title,
        message=row.message,
        severity=row.severity,
        alert_rule_id=row.alert_rule_id,
        conversation_id=row.conversation_id,
        lead_id=row.lead_id,
        payload=row.payload or {},
        delivered_at=row.delivered_at,
        read_at=row.read_at,
    )


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = Query(default=False),
    severity: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> NotificationListResponse:
    """List all notifications for the current workspace, newest first."""
    query = (
        select(AlertNotification)
        .where(AlertNotification.workspace_id == auth.user_id)
        .order_by(AlertNotification.delivered_at.desc())
    )
    count_query = select(func.count(AlertNotification.id)).where(AlertNotification.workspace_id == auth.user_id)

    if unread_only:
        query = query.where(AlertNotification.read_at.is_(None))
        count_query = count_query.where(AlertNotification.read_at.is_(None))
    if severity:
        query = query.where(AlertNotification.severity == severity)
        count_query = count_query.where(AlertNotification.severity == severity)

    query = query.limit(limit).offset(offset)
    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return NotificationListResponse(
        data=[_notif_out(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> UnreadCountResponse:
    """Return count of unread notifications."""
    count = (
        await session.execute(
            select(func.count(AlertNotification.id)).where(
                AlertNotification.workspace_id == auth.user_id,
                AlertNotification.read_at.is_(None),
            )
        )
    ).scalar_one()
    return UnreadCountResponse(unread_count=count)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
async def mark_as_read(
    notification_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> NotificationOut:
    """Mark a notification as read."""
    row = await session.get(AlertNotification, notification_id)
    if not row or row.workspace_id != auth.user_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Notification not found")
    if not row.read_at:
        row.read_at = datetime.now(timezone.utc)
        await session.commit()
        await session.refresh(row)
    return _notif_out(row)


@router.patch("/read-all", response_model=UnreadCountResponse)
async def mark_all_read(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> UnreadCountResponse:
    """Mark all unread notifications as read."""
    now = datetime.now(timezone.utc)
    rows = (
        await session.execute(
            select(AlertNotification).where(
                AlertNotification.workspace_id == auth.user_id,
                AlertNotification.read_at.is_(None),
            )
        )
    ).scalars().all()
    for row in rows:
        row.read_at = now
    await session.commit()
    return UnreadCountResponse(unread_count=0)


@router.websocket("/ws")
async def notification_ws(
    websocket: WebSocket,
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    """WebSocket endpoint for real-time notification push.

    Connect with ?token=<jwt> or ?workspace_id=<id> in dev mode.
    Receives events: {"event": "notification.created", "data": {...}}
    """
    from app.inbox.ws_hub import register_notification_socket, unregister_notification_socket

    # Resolve workspace ID
    token = websocket.query_params.get("token")
    dev_workspace_id = websocket.query_params.get("workspace_id") or websocket.query_params.get("dev_workspace_id")

    workspace_id: str | None = None
    if token:
        try:
            payload = await verify_supabase_token(token)
            workspace_id = str(payload.get("sub") or "")
        except AuthError:
            await websocket.close(code=4401)
            return
    elif settings.allow_anon_dev and settings.debug:
        workspace_id = dev_workspace_id or "dev-user"

    if not workspace_id:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    await register_notification_socket(workspace_id, websocket)
    try:
        while True:
            try:
                # Keep alive — client can send ping
                await websocket.receive_text()
            except WebSocketDisconnect:
                break
    finally:
        await unregister_notification_socket(workspace_id, websocket)
