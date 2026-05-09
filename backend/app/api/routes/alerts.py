"""Alerts and Notifications API routes for AI escalation events."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import AlertNotification, Conversation, Lead, Contact


router = APIRouter()


@router.get("/notifications")
async def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    """List alert notifications for the current user's workspace."""
    query = (
        select(AlertNotification)
        .where(AlertNotification.workspace_id == auth.user_id)
        .order_by(AlertNotification.delivered_at.desc())
        .limit(limit)
        .offset(offset)
    )
    count_query = select(func.count(AlertNotification.id)).where(
        AlertNotification.workspace_id == auth.user_id
    )

    if unread_only:
        query = query.where(AlertNotification.read_at.is_(None))
        count_query = count_query.where(AlertNotification.read_at.is_(None))

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()
    unread_total = (
        await session.execute(
            select(func.count(AlertNotification.id)).where(
                AlertNotification.workspace_id == auth.user_id,
                AlertNotification.read_at.is_(None),
            )
        )
    ).scalar_one()

    # Enrich notifications with conversation contact info
    enriched = []
    for notification in rows:
        conv_name = None
        if notification.conversation_id:
            conv = await session.get(Conversation, notification.conversation_id)
            if conv and conv.contact_id:
                contact = await session.get(Contact, conv.contact_id)
                if contact:
                    conv_name = contact.name

        enriched.append({
            "id": notification.id,
            "alert_rule_id": notification.alert_rule_id,
            "conversation_id": notification.conversation_id,
            "lead_id": notification.lead_id,
            "title": notification.title,
            "message": notification.message,
            "severity": notification.severity,
            "payload": notification.payload,
            "contact_name": conv_name,
            "delivered_at": notification.delivered_at.isoformat() if notification.delivered_at else None,
            "read_at": notification.read_at.isoformat() if notification.read_at else None,
        })

    return {
        "data": enriched,
        "meta": {
            "total": total,
            "unread": unread_total,
            "limit": limit,
            "offset": offset,
        },
    }


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    """Mark a single notification as read."""
    stmt = (
        update(AlertNotification)
        .where(
            AlertNotification.id == notification_id,
            AlertNotification.workspace_id == auth.user_id,
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    result = await session.execute(stmt)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    await session.commit()
    return {"success": True}


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    """Mark all unread notifications as read for this workspace."""
    stmt = (
        update(AlertNotification)
        .where(
            AlertNotification.workspace_id == auth.user_id,
            AlertNotification.read_at.is_(None),
        )
        .values(read_at=datetime.now(timezone.utc))
    )
    await session.execute(stmt)
    await session.commit()
    return {"success": True}


@router.delete("/notifications/{notification_id}")
async def delete_notification(
    notification_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    """Delete a notification."""
    stmt = select(AlertNotification).where(
        AlertNotification.id == notification_id,
        AlertNotification.workspace_id == auth.user_id,
    )
    result = await session.execute(stmt)
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    await session.delete(notification)
    await session.commit()
    return {"success": True}