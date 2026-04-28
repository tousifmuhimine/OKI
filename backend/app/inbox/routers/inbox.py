from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Contact, Conversation, Inbox, Message
from app.inbox.channels import ChannelSendError, send_channel_message
from app.inbox.channels.email import send_direct_message
from app.inbox.security import decrypt_channel_config
from app.inbox.security import summarize_channel_config
from app.schemas.common import PaginationMeta
from app.schemas.inbox import (
    ChannelType,
    ContactCreate,
    ContactListResponse,
    ContactOut,
    ConversationListResponse,
    ConversationOut,
    ConversationStatus,
    EmailComposeCreate,
    InboxOut,
    MessageCreate,
    MessageListResponse,
    MessageOut,
)


router = APIRouter()


def _contact_out(contact: Contact | None) -> ContactOut | None:
    if not contact:
        return None
    return ContactOut.model_validate(contact)


def _inbox_out(inbox: Inbox | None) -> InboxOut | None:
    if not inbox:
        return None
    data = {
        "id": inbox.id,
        "workspace_id": inbox.workspace_id,
        "name": inbox.name,
        "channel_type": inbox.channel_type,
        "channel_config": summarize_channel_config(inbox.channel_config),
        "created_at": inbox.created_at,
    }
    return InboxOut.model_validate(data)


def _message_out(message: Message) -> MessageOut:
    return MessageOut.model_validate(
        {
            "id": message.id,
            "conversation_id": message.conversation_id,
            "content": message.content,
            "message_type": message.message_type,
            "sender_type": message.sender_type,
            "sender_id": message.sender_id,
            "metadata": message.message_metadata,
            "created_at": message.created_at,
        }
    )


async def _get_owned_conversation(
    conversation_id: str,
    workspace_id: str,
    session: AsyncSession,
) -> Conversation:
    conversation = await session.get(Conversation, conversation_id)
    if not conversation or conversation.workspace_id != workspace_id:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.get("/conversations", response_model=ConversationListResponse)
async def list_conversations(
    status_filter: ConversationStatus | None = Query(default=None, alias="status"),
    channel: ChannelType | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> ConversationListResponse:
    query = (
        select(Conversation, Contact, Inbox)
        .join(Contact, Contact.id == Conversation.contact_id)
        .join(Inbox, Inbox.id == Conversation.inbox_id)
        .where(Conversation.workspace_id == auth.user_id)
    )
    count_query = select(func.count(Conversation.id)).where(Conversation.workspace_id == auth.user_id)

    if status_filter:
        query = query.where(Conversation.status == status_filter)
        count_query = count_query.where(Conversation.status == status_filter)
    if channel:
        query = query.where(Conversation.channel_type == channel)
        count_query = count_query.where(Conversation.channel_type == channel)

    query = query.order_by(Conversation.last_message_at.desc().nullslast()).limit(limit).offset(offset)

    rows = (await session.execute(query)).all()
    total = (await session.execute(count_query)).scalar_one()

    data: list[ConversationOut] = []
    for conversation, contact, inbox in rows:
        last_message = (
            await session.execute(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
        data.append(
            ConversationOut(
                id=conversation.id,
                workspace_id=conversation.workspace_id,
                inbox_id=conversation.inbox_id,
                contact_id=conversation.contact_id,
                status=conversation.status,
                channel_type=conversation.channel_type,
                last_message_at=conversation.last_message_at,
                created_at=conversation.created_at,
                contact=_contact_out(contact),
                inbox=_inbox_out(inbox),
                last_message_preview=last_message.content if last_message else None,
            )
        )

    return ConversationListResponse(
        data=data,
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationOut)
async def get_conversation(
    conversation_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> ConversationOut:
    conversation = await _get_owned_conversation(conversation_id, auth.user_id, session)
    contact = await session.get(Contact, conversation.contact_id)
    inbox = await session.get(Inbox, conversation.inbox_id)
    last_message = (
        await session.execute(
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    return ConversationOut(
        id=conversation.id,
        workspace_id=conversation.workspace_id,
        inbox_id=conversation.inbox_id,
        contact_id=conversation.contact_id,
        status=conversation.status,
        channel_type=conversation.channel_type,
        last_message_at=conversation.last_message_at,
        created_at=conversation.created_at,
        contact=_contact_out(contact),
        inbox=_inbox_out(inbox),
        last_message_preview=last_message.content if last_message else None,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=MessageListResponse)
async def list_messages(
    conversation_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> MessageListResponse:
    await _get_owned_conversation(conversation_id, auth.user_id, session)

    query = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .limit(limit)
        .offset(offset)
    )
    count_query = select(func.count(Message.id)).where(Message.conversation_id == conversation_id)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return MessageListResponse(
        data=[_message_out(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_message(
    conversation_id: str,
    payload: MessageCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> MessageOut:
    conversation = await _get_owned_conversation(conversation_id, auth.user_id, session)
    inbox = await session.get(Inbox, conversation.inbox_id)
    contact = await session.get(Contact, conversation.contact_id)
    if not inbox or inbox.workspace_id != auth.user_id:
        raise HTTPException(status_code=404, detail="Inbox not found")

    channel_config = decrypt_channel_config(inbox.channel_config)
    subject = payload.metadata.get("email_subject")
    if conversation.channel_type == "email" and isinstance(subject, str) and subject.strip():
        channel_config = {**channel_config, "subject": subject.strip()}

    try:
        channel_result = await send_channel_message(
            conversation=conversation,
            message_text=payload.content,
            channel_config=channel_config,
            contact=contact,
        )
    except (ChannelSendError, RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Channel provider send failed") from exc

    message = Message(
        conversation_id=conversation.id,
        content=payload.content,
        message_type="outgoing",
        sender_type="agent",
        sender_id=auth.user_id,
        message_metadata={**payload.metadata, "channel_result": channel_result},
    )
    conversation.last_message_at = datetime.now(timezone.utc)

    session.add(message)
    await session.commit()
    await session.refresh(message)
    return _message_out(message)


@router.post("/email/messages", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def compose_email_message(
    payload: EmailComposeCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> ConversationOut:
    inbox_query = select(Inbox).where(
        Inbox.workspace_id == auth.user_id,
        Inbox.channel_type == "email",
    )
    if payload.inbox_id:
        inbox_query = inbox_query.where(Inbox.id == payload.inbox_id)
    inbox = (await session.execute(inbox_query.order_by(Inbox.created_at.asc()).limit(1))).scalar_one_or_none()
    if not inbox:
        raise HTTPException(status_code=404, detail="Connect an email channel before sending mail")

    email_address = payload.to_email.strip().lower()
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
            name=payload.to_name or email_address,
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
        )
        session.add(conversation)
        await session.flush()

    try:
        channel_result = await send_direct_message(
            message_text=payload.content,
            channel_config=decrypt_channel_config(inbox.channel_config),
            contact=contact,
            subject=payload.subject,
        )
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Email provider send failed") from exc

    message = Message(
        conversation_id=conversation.id,
        content=payload.content,
        message_type="outgoing",
        sender_type="agent",
        sender_id=auth.user_id,
        message_metadata={
            **payload.metadata,
            "email_subject": payload.subject,
            "channel_result": channel_result,
        },
    )
    conversation.last_message_at = datetime.now(timezone.utc)
    session.add(message)
    await session.commit()

    return ConversationOut(
        id=conversation.id,
        workspace_id=conversation.workspace_id,
        inbox_id=conversation.inbox_id,
        contact_id=conversation.contact_id,
        status=conversation.status,
        channel_type=conversation.channel_type,
        last_message_at=conversation.last_message_at,
        created_at=conversation.created_at,
        contact=_contact_out(contact),
        inbox=_inbox_out(inbox),
        last_message_preview=message.content,
    )


@router.get("/contacts", response_model=ContactListResponse)
async def list_contacts(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> ContactListResponse:
    query = (
        select(Contact)
        .where(Contact.workspace_id == auth.user_id)
        .order_by(Contact.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    count_query = select(func.count(Contact.id)).where(Contact.workspace_id == auth.user_id)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return ContactListResponse(
        data=[ContactOut.model_validate(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("/contacts", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: ContactCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> ContactOut:
    contact = Contact(workspace_id=auth.user_id, **payload.model_dump())

    session.add(contact)
    await session.commit()
    await session.refresh(contact)
    return ContactOut.model_validate(contact)
