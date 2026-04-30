from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Contact, Conversation, Inbox, Message
from app.inbox.channels.email import fetch_messages
from app.inbox.security import decrypt_channel_config, encrypt_channel_config, summarize_channel_config
from app.schemas.common import PaginationMeta
from app.schemas.inbox import InboxCreate, InboxOut, IntegrationListResponse


router = APIRouter()


def _inbox_out(inbox: Inbox) -> InboxOut:
    return InboxOut.model_validate(
        {
            "id": inbox.id,
            "workspace_id": inbox.workspace_id,
            "name": inbox.name,
            "channel_type": inbox.channel_type,
            "channel_config": summarize_channel_config(inbox.channel_config),
            "created_at": inbox.created_at,
        }
    )


@router.get("", response_model=IntegrationListResponse)
async def list_integrations(
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> IntegrationListResponse:
    query = (
        select(Inbox)
        .where(Inbox.workspace_id == auth.user_id)
        .order_by(Inbox.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    count_query = select(func.count(Inbox.id)).where(Inbox.workspace_id == auth.user_id)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return IntegrationListResponse(
        data=[_inbox_out(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("/email/sync")
async def sync_email_integrations(
    limit: int = Query(default=25, ge=1, le=100),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> dict[str, int]:
    inboxes = (
        await session.execute(
            select(Inbox).where(
                Inbox.workspace_id == auth.user_id,
                Inbox.channel_type == "email",
            )
        )
    ).scalars().all()

    imported = 0
    skipped = 0
    for inbox in inboxes:
        try:
            incoming = await fetch_messages(decrypt_channel_config(inbox.channel_config), limit=limit)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Could not connect to email inbox") from exc

        for item in incoming:
            email_address = item.get("from_email")
            if not email_address:
                skipped += 1
                continue

            contact = (
                await session.execute(
                    select(Contact).where(
                        Contact.workspace_id == auth.user_id,
                        Contact.email == email_address,
                    )
                )
            ).scalar_one_or_none()
            if not contact:
                contact = Contact(
                    workspace_id=auth.user_id,
                    name=item.get("from_name") or email_address,
                    email=email_address,
                    channel_identifiers={"email": email_address},
                )
                session.add(contact)
                await session.flush()

            conversation = (
                await session.execute(
                    select(Conversation).where(
                        Conversation.workspace_id == auth.user_id,
                        Conversation.inbox_id == inbox.id,
                        Conversation.contact_id == contact.id,
                    )
                )
            ).scalar_one_or_none()
            if not conversation:
                conversation = Conversation(
                    workspace_id=auth.user_id,
                    inbox_id=inbox.id,
                    contact_id=contact.id,
                    channel_type="email",
                    last_message_at=datetime.now(timezone.utc),
                )
                session.add(conversation)
                await session.flush()

            metadata = {
                "email_uid": item.get("uid"),
                "email_message_id": item.get("message_id"),
                "email_subject": item.get("subject"),
                "inbox_id": inbox.id,
            }
            exists = (
                await session.execute(
                    select(Message.id)
                    .where(Message.conversation_id == conversation.id)
                    .where(Message.message_metadata.contains({"email_uid": item.get("uid"), "inbox_id": inbox.id}))
                    .limit(1)
                )
            ).scalar_one_or_none()
            if exists:
                skipped += 1
                continue

            subject = item.get("subject")
            body = item.get("body") or "(No email body)"
            content = f"Subject: {subject}\n\n{body}" if subject else body
            message = Message(
                conversation_id=conversation.id,
                content=content,
                message_type="incoming",
                sender_type="contact",
                sender_id=contact.id,
                message_metadata=metadata,
            )
            conversation.last_message_at = datetime.now(timezone.utc)
            session.add(message)
            imported += 1

    await session.commit()
    return {"imported": imported, "skipped": skipped, "inboxes": len(inboxes)}


@router.post("", response_model=InboxOut, status_code=status.HTTP_201_CREATED)
async def create_integration(
    payload: InboxCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> InboxOut:
    inbox = Inbox(
        workspace_id=auth.user_id,
        name=payload.name,
        channel_type=payload.channel_type,
        channel_config=encrypt_channel_config(payload.channel_config),
    )

    session.add(inbox)
    await session.commit()
    await session.refresh(inbox)
    return _inbox_out(inbox)


@router.delete("/{inbox_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    inbox_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    # Verify inbox exists and belongs to the user
    inbox = await session.get(Inbox, inbox_id)
    if not inbox:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    if inbox.workspace_id != auth.user_id:
        raise HTTPException(status_code=404, detail="Integration not found")
    
    # Use delete statement for async SQLAlchemy
    await session.execute(delete(Inbox).where(Inbox.id == inbox_id))
    await session.commit()
