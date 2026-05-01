from datetime import datetime, timezone
from typing import Any, Iterable

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session_dep
from app.core.config import settings
from app.db.models import Contact, Conversation, Inbox, Message
from app.inbox.security import decrypt_channel_config
from app.services.lead_capture import upsert_lead_from_inbound_message
from app.schemas.inbox import WebhookAck


router = APIRouter()


def _iter_entries(payload: dict[str, Any]) -> Iterable[dict[str, Any]]:
    entries = payload.get("entry")
    if not isinstance(entries, list):
        return []
    return [entry for entry in entries if isinstance(entry, dict)]


def _iter_messaging_events(payload: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for entry in _iter_entries(payload):
        messages = entry.get("messaging")
        if not isinstance(messages, list):
            continue
        for message in messages:
            if isinstance(message, dict):
                yield message


def _iter_whatsapp_events(payload: dict[str, Any]) -> Iterable[dict[str, Any]]:
    for entry in _iter_entries(payload):
        changes = entry.get("changes")
        if not isinstance(changes, list):
            continue
        for change in changes:
            if isinstance(change, dict):
                value = change.get("value")
                if isinstance(value, dict):
                    yield value


async def _resolve_inbox(
    session: AsyncSession,
    channel_type: str,
    config_key: str,
    config_value: str,
) -> Inbox | None:
    rows = (
        await session.execute(
            select(Inbox).where(
                Inbox.channel_type == channel_type,
            )
        )
    ).scalars().all()

    for inbox in rows:
        try:
            channel_config = decrypt_channel_config(inbox.channel_config)
        except RuntimeError:
            continue
        if str(channel_config.get(config_key)) == str(config_value):
            return inbox
    return None


async def _find_or_create_contact(
    session: AsyncSession,
    workspace_id: str,
    inbox: Inbox,
    channel_key: str,
    channel_value: str,
    name: str,
    phone: str | None = None,
) -> Contact:
    contact = (
        await session.execute(
            select(Contact).where(
                Contact.workspace_id == workspace_id,
                Contact.channel_identifiers.contains({channel_key: channel_value}),
            )
        )
    ).scalar_one_or_none()

    if contact:
        if name and contact.name != name:
            contact.name = name
        if phone and not contact.phone:
            contact.phone = phone
        return contact

    contact = Contact(
        workspace_id=workspace_id,
        name=name,
        phone=phone,
        channel_identifiers={channel_key: channel_value, "inbox_id": inbox.id},
    )
    session.add(contact)
    await session.flush()
    return contact


async def _find_or_create_conversation(
    session: AsyncSession,
    workspace_id: str,
    inbox: Inbox,
    contact: Contact,
    channel_type: str,
) -> Conversation:
    conversation = (
        await session.execute(
            select(Conversation).where(
                Conversation.workspace_id == workspace_id,
                Conversation.inbox_id == inbox.id,
                Conversation.contact_id == contact.id,
            )
        )
    ).scalar_one_or_none()

    if conversation:
        return conversation

    conversation = Conversation(
        workspace_id=workspace_id,
        inbox_id=inbox.id,
        contact_id=contact.id,
        channel_type=channel_type,
        last_message_at=datetime.now(timezone.utc),
    )
    session.add(conversation)
    await session.flush()
    return conversation


async def _store_message(
    session: AsyncSession,
    conversation: Conversation,
    contact: Contact,
    content: str,
    channel_type: str,
    sender_key: str,
    sender_value: str,
    message_id: str | None,
    raw_event: dict[str, Any],
) -> bool:
    metadata = {
        "channel": channel_type,
        "sender_key": sender_key,
        "sender_value": sender_value,
        "message_id": message_id,
        "raw_event": raw_event,
    }

    if message_id:
        existing = (
            await session.execute(
                select(Message.id).where(
                    Message.conversation_id == conversation.id,
                    Message.message_metadata.contains({"message_id": message_id, "channel": channel_type}),
                )
            )
        ).scalar_one_or_none()
        if existing:
            return False

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
    await session.flush()
    return True


async def _ingest_messaging_payload(
    session: AsyncSession,
    channel_type: str,
    config_key: str,
    payload: dict[str, Any],
) -> dict[str, int]:
    stats = {"processed": 0, "skipped": 0, "skipped_no_inbox": 0}
    for event in _iter_messaging_events(payload):
        sender = event.get("sender")
        message = event.get("message")
        if not isinstance(sender, dict) or not isinstance(message, dict):
            stats["skipped"] += 1
            continue

        sender_id = sender.get("id")
        if not sender_id:
            stats["skipped"] += 1
            continue

        recipient = event.get("recipient")
        recipient_id = str(recipient.get("id")) if isinstance(recipient, dict) and recipient.get("id") else ""
        if not recipient_id:
            stats["skipped"] += 1
            continue

        inbox = await _resolve_inbox(session, channel_type, config_key, recipient_id)
        if not inbox:
            stats["skipped_no_inbox"] += 1
            continue

        text = message.get("text")
        if not isinstance(text, str) or not text.strip():
            stats["skipped"] += 1
            continue

        contact_name = sender.get("name") or ("Instagram user" if channel_type == "instagram" else "Messenger user")
        contact = await _find_or_create_contact(
            session=session,
            workspace_id=inbox.workspace_id,
            inbox=inbox,
            channel_key="instagram_id" if channel_type == "instagram" else "facebook_id",
            channel_value=str(sender_id),
            name=str(contact_name),
        )
        conversation = await _find_or_create_conversation(session, inbox.workspace_id, inbox, contact, channel_type)
        if await _store_message(
            session=session,
            conversation=conversation,
            contact=contact,
            content=text,
            channel_type=channel_type,
            sender_key="sender.id",
            sender_value=str(sender_id),
            message_id=str(message.get("mid") or event.get("message_id") or "") or None,
            raw_event=event,
        ):
            await upsert_lead_from_inbound_message(
                session,
                inbox=inbox,
                contact=contact,
                conversation=conversation,
                channel_type=channel_type,
                capture_source="auto",
            )
            stats["processed"] += 1
        else:
            stats["skipped"] += 1
    return stats


async def _ingest_whatsapp_payload(
    session: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, int]:
    stats = {"processed": 0, "skipped": 0, "skipped_no_inbox": 0}
    for value in _iter_whatsapp_events(payload):
        metadata = value.get("metadata")
        if not isinstance(metadata, dict):
            stats["skipped"] += 1
            continue

        phone_number_id = metadata.get("phone_number_id")
        if not phone_number_id:
            stats["skipped"] += 1
            continue

        inbox = await _resolve_inbox(session, "whatsapp", "phone_number_id", str(phone_number_id))
        if not inbox:
            stats["skipped_no_inbox"] += 1
            continue

        messages = value.get("messages")
        contacts = value.get("contacts")
        if not isinstance(messages, list) or not messages:
            stats["skipped"] += 1
            continue
        if not isinstance(contacts, list) or not contacts:
            stats["skipped"] += 1
            continue

        contact_info = contacts[0] if isinstance(contacts[0], dict) else {}
        wa_id = str(contact_info.get("wa_id") or "")
        if not wa_id:
            stats["skipped"] += 1
            continue

        profile = contact_info.get("profile") if isinstance(contact_info.get("profile"), dict) else {}
        contact_name = str(profile.get("name") or wa_id)
        contact = await _find_or_create_contact(
            session=session,
            workspace_id=inbox.workspace_id,
            inbox=inbox,
            channel_key="whatsapp",
            channel_value=wa_id,
            name=contact_name,
            phone=wa_id,
        )
        conversation = await _find_or_create_conversation(session, inbox.workspace_id, inbox, contact, "whatsapp")

        for message in messages:
            if not isinstance(message, dict):
                continue
            text = message.get("text")
            if not isinstance(text, dict):
                continue
            body = text.get("body")
            if not isinstance(body, str) or not body.strip():
                stats["skipped"] += 1
                continue

            if await _store_message(
                session=session,
                conversation=conversation,
                contact=contact,
                content=body,
                channel_type="whatsapp",
                sender_key="contacts.wa_id",
                sender_value=wa_id,
                message_id=str(message.get("id") or "") or None,
                raw_event=value,
            ):
                await upsert_lead_from_inbound_message(
                    session,
                    inbox=inbox,
                    contact=contact,
                    conversation=conversation,
                    channel_type="whatsapp",
                    capture_source="auto",
                )
                stats["processed"] += 1
            else:
                stats["skipped"] += 1
    return stats


async def _json_payload(request: Request) -> dict[str, Any]:
    try:
        payload = await request.json()
    except ValueError:
        payload = {}
    return payload if isinstance(payload, dict) else {"payload": payload}


@router.get("/webhooks/facebook", response_class=PlainTextResponse)
async def verify_facebook_webhook(
    mode: str | None = Query(default=None, alias="hub.mode"),
    token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> str:
    if mode == "subscribe" and challenge and token == settings.meta_webhook_verify_token:
        return challenge
    raise HTTPException(status_code=403, detail="Invalid webhook verification token")


@router.get("/webhooks/instagram", response_class=PlainTextResponse)
async def verify_instagram_webhook(
    mode: str | None = Query(default=None, alias="hub.mode"),
    token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> str:
    if mode == "subscribe" and challenge and token == settings.meta_webhook_verify_token:
        return challenge
    raise HTTPException(status_code=403, detail="Invalid webhook verification token")


@router.get("/webhooks/whatsapp", response_class=PlainTextResponse)
async def verify_whatsapp_webhook(
    mode: str | None = Query(default=None, alias="hub.mode"),
    token: str | None = Query(default=None, alias="hub.verify_token"),
    challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> str:
    if mode == "subscribe" and challenge and token == settings.meta_webhook_verify_token:
        return challenge
    raise HTTPException(status_code=403, detail="Invalid webhook verification token")


@router.post("/webhooks/facebook", response_model=WebhookAck)
async def receive_facebook_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session_dep),
) -> WebhookAck:
    payload = await _json_payload(request)
    stats = await _ingest_messaging_payload(session, "facebook", "page_id", payload)
    await session.commit()
    return WebhookAck(**stats)


@router.post("/webhooks/instagram", response_model=WebhookAck)
async def receive_instagram_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session_dep),
) -> WebhookAck:
    payload = await _json_payload(request)
    stats = await _ingest_messaging_payload(session, "instagram", "instagram_business_account_id", payload)
    await session.commit()
    return WebhookAck(**stats)


@router.post("/webhooks/whatsapp", response_model=WebhookAck)
async def receive_whatsapp_webhook(
    request: Request,
    session: AsyncSession = Depends(get_session_dep),
) -> WebhookAck:
    payload = await _json_payload(request)
    stats = await _ingest_whatsapp_payload(session, payload)
    await session.commit()
    return WebhookAck(**stats)


@router.post("/webhooks/email", response_model=WebhookAck)
async def receive_email_webhook(
    request: Request,
) -> WebhookAck:
    await _json_payload(request)
    return WebhookAck()
