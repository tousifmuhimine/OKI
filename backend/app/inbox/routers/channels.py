from datetime import datetime, timezone
from typing import Any, Iterable
import asyncio
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session_dep
from app.core.config import settings
from app.core.security import AuthError, verify_supabase_token
from app.db.models import Contact, Conversation, Inbox, Lead, Message, AIEvent
from app.db.models import UserLLMConfig
from app.db.models import Task
from app.inbox.llm_providers.groq import DEFAULT_GROQ_MODEL
from app.inbox.security import decrypt_channel_config
from app.services.lead_capture import upsert_lead_from_inbound_message
from app.services.entity_extraction import detect_intent_from_message, update_lead_intent
from app.services.intelligence import evaluate_intelligence_alerts, record_preference_history, create_alert_notification
from app.services.conversation_stage import detect_conversation_stage, analyze_message_signals
from app.schemas.inbox import WebhookAck
from app.inbox.llm_providers.groq import GroqProvider
from app.inbox.channels import send_channel_message
from app.inbox.security import decrypt_channel_config as decrypt_user_config


logger = logging.getLogger(__name__)
router = APIRouter()


async def _resolve_websocket_workspace_id(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    workspace_id = websocket.query_params.get("workspace_id") or websocket.query_params.get("dev_workspace_id")

    if token:
        try:
            payload = await verify_supabase_token(token)
        except AuthError:
            return None
        return str(payload.get("sub") or workspace_id or "") or None

    if settings.allow_anon_dev and settings.debug:
        return str(workspace_id or "dev-user")

    return None


@router.websocket("/ws/conversations/{conversation_id}")
async def conversation_ws(websocket: WebSocket, conversation_id: str, session: AsyncSession = Depends(get_session_dep)):
    workspace_id = await _resolve_websocket_workspace_id(websocket)
    if not workspace_id:
        await websocket.close(code=4401)
        return

    conversation = await session.get(Conversation, conversation_id)
    if not conversation or conversation.workspace_id != workspace_id:
        await websocket.close(code=4403)
        return

    await websocket.accept()
    from app.inbox.ws_hub import register, unregister

    await register(conversation_id, websocket)
    try:
        while True:
            try:
                data = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            text = data.strip()
            if not text or conversation.channel_type not in {"website", "api"}:
                continue

            try:
                payload = json.loads(text)
            except ValueError:
                payload = None

            if isinstance(payload, dict):
                candidate = payload.get("content") or payload.get("text") or payload.get("message")
                if isinstance(candidate, str) and candidate.strip():
                    text = candidate.strip()

            if not text:
                continue

            contact = await session.get(Contact, conversation.contact_id)
            inbox = await session.get(Inbox, conversation.inbox_id)
            if not contact or not inbox:
                continue

            if await _store_message(
                session=session,
                conversation=conversation,
                contact=contact,
                content=text,
                channel_type=conversation.channel_type,
                sender_key="widget",
                sender_value=conversation.contact_id,
                message_id=None,
                raw_event={"source": "website_widget", "conversation_id": conversation.id},
            ):
                await upsert_lead_from_inbound_message(
                    session,
                    inbox=inbox,
                    contact=contact,
                    conversation=conversation,
                    channel_type=conversation.channel_type,
                    capture_source="auto",
                )
                try:
                    await _maybe_auto_reply(session, conversation, contact, inbox, text)
                except Exception as exc:
                    logger.error("[auto-reply] unhandled error: %s", exc, exc_info=True)
                await session.commit()
    finally:
        await unregister(conversation_id, websocket)


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


async def _get_conversation_lead(session: AsyncSession, conversation_id: str) -> Lead | None:
    row = (
        await session.execute(
            select(Lead)
            .where(Lead.conversation_id == conversation_id)
            .order_by(Lead.updated_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()
    return row


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

    try:
        from app.inbox.ws_hub import broadcast

        await broadcast(
            conversation.id,
            {
                "conversation_id": conversation.id,
                "message": {
                    "id": message.id,
                    "content": content,
                    "sender_type": "contact",
                    "sender_id": contact.id,
                    "message_type": "incoming",
                    "created_at": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
                },
                "event": "message.created",
            },
        )
    except Exception as exc:
        logger.debug("[ws-broadcast] skipped for conversation=%s: %s", conversation.id, exc)

    return True


def _estimate_tokens(text: str) -> int:
    # Rough heuristic: average English prose is about 4 chars/token.
    return max(1, int(len(text) / 4))


def _model_context_window(provider: str, model: str) -> int:
    provider = (provider or "").lower()
    model = (model or "").lower()

    provider_windows = {
        "groq": {
            "llama-3.1-8b-instant": 131072,
            "llama-3.3-70b-versatile": 131072,
            "openai/gpt-oss-120b": 131072,
            "openai/gpt-oss-20b": 131072,
        },
    }

    if provider in provider_windows:
        for key, window in provider_windows[provider].items():
            if key in model:
                return window

    # sensible fallback for models we don't know yet
    return 4096


def _reserved_reply_tokens(provider: str, model: str) -> int:
    provider = (provider or "").lower()
    model = (model or "").lower()

    reserve_map = {
        "groq": {
            "llama-3.1": 256,
            "llama-3.3": 256,
            "gpt-oss": 256,
        },
    }

    if provider in reserve_map:
        for key, reserve in reserve_map[provider].items():
            if key in model:
                return reserve

    return 256


async def _maybe_auto_reply(
    session: AsyncSession,
    conversation: Conversation,
    contact: Contact | None,
    inbox: Inbox,
    incoming_text: str,
):
    logger.info(
        "[auto-reply] triggered for conversation=%s channel=%s",
        conversation.id,
        conversation.channel_type,
    )
    # map conversation.channel_type to front-end channel keys
    if conversation.channel_type == "whatsapp":
        platform_key = "whatsapp"
    elif conversation.channel_type == "email":
        platform_key = "email"
    else:
        # facebook / instagram -> messenger
        platform_key = "messenger"

    # Skip auto-reply if conversation is already handed over or bot paused
    try:
        if getattr(conversation, "is_bot_paused", False) or getattr(conversation, "assigned_user_id", None):
            logger.info("[auto-reply] skipped: conversation is paused or assigned: %s", conversation.id)
            return
    except Exception:
        # defensive: if attribute access fails, continue
        pass

    # fetch the matching LLM config for this channel, not just the first row
    q = select(UserLLMConfig).where(
        UserLLMConfig.user_id == inbox.workspace_id,
        UserLLMConfig.provider == "groq",
    )
    res = await session.execute(q)
    llm_candidates = res.scalars().all()
    llm = None
    for candidate in llm_candidates:
        modes = getattr(candidate, "automation_modes", {}) or {}
        if modes.get(platform_key) == "chatbot":
            llm = candidate
            break

    if not llm:
        return

    try:
        user_cfg = decrypt_user_config(llm.encrypted_config)
    except RuntimeError:
        return

    api_key = user_cfg.get("api_key")
    if not api_key:
        return

    modes = getattr(llm, "automation_modes", {}) or {}

    if modes.get(platform_key) != "chatbot":
        return

    model = llm.default_model or DEFAULT_GROQ_MODEL

    lead = await _get_conversation_lead(session, conversation.id)

    # Count messages for stage detection
    msg_count_result = await session.execute(
        select(Message).where(Message.conversation_id == conversation.id)
    )
    message_count = len(msg_count_result.scalars().all())

    detected_intent = None
    try:
        classification = await detect_intent_from_message(
            session,
            message=incoming_text,
            workspace_id=inbox.workspace_id,
            user_id=inbox.workspace_id,
        )
        detected_intent = classification.intent
        if lead and detected_intent:
            await update_lead_intent(session, lead.id, detected_intent)
        if lead:
            await record_preference_history(
                session,
                workspace_id=inbox.workspace_id,
                lead=lead,
                text=incoming_text,
                detected_from="conversation",
            )
    except Exception as exc:
        logger.debug("[auto-reply] intent detection skipped: %s", exc)

    # Conversation stage classification
    conv_stage = detect_conversation_stage(lead=lead, message_count=message_count)

    # Detect negotiation / frustration / high intent / drop-off signals
    msg_signals = analyze_message_signals(incoming_text)
    if msg_signals.alert_type and not conversation.is_bot_paused:
        try:
            alert_titles = {
                "hot_lead": "🔥 Hot Lead — High Intent Detected",
                "negotiation": "💬 Negotiation Signal Detected",
                "frustration": "⚠️ Customer Frustration Detected",
                "drop_off_risk": "📉 Drop-off Risk Detected",
            }
            alert_messages = {
                "hot_lead": f"Customer sent a strong buying signal: '{incoming_text[:200]}'",
                "negotiation": f"Customer is negotiating price: '{incoming_text[:200]}'",
                "frustration": f"Customer appears frustrated: '{incoming_text[:200]}'",
                "drop_off_risk": f"Customer may be dropping off: '{incoming_text[:200]}'",
            }
            alert_type = msg_signals.alert_type
            notif = await create_alert_notification(
                session,
                workspace_id=inbox.workspace_id,
                title=alert_titles.get(alert_type, "AI Alert"),
                message=alert_messages.get(alert_type, incoming_text[:200]),
                severity=msg_signals.severity,
                conversation_id=conversation.id,
                lead_id=lead.id if lead else None,
                payload={
                    "alert_type": alert_type,
                    "matched_patterns": msg_signals.matched_patterns,
                    "conv_stage": conv_stage.stage,
                },
            )
            # Broadcast alert notification via WS
            try:
                from app.inbox.ws_hub import broadcast_notification
                await broadcast_notification(
                    workspace_id=inbox.workspace_id,
                    notification={
                        "id": notif.id,
                        "title": notif.title,
                        "message": notif.message,
                        "severity": notif.severity,
                        "alert_type": alert_type,
                        "conversation_id": conversation.id,
                        "lead_id": lead.id if lead else None,
                        "delivered_at": notif.delivered_at.isoformat() if notif.delivered_at else None,
                    },
                )
            except Exception as ws_exc:
                logger.debug("[auto-reply] WS notification broadcast skipped: %s", ws_exc)
        except Exception as alert_exc:
            logger.debug("[auto-reply] signal alert creation failed: %s", alert_exc)

    # simple handover heuristic: keywords and certain detected intents
    def _should_handover(text: str, intent: str | None) -> bool:
        if not text:
            return False
        t = text.lower()
        keywords = [
            "price",
            "quote",
            "booking",
            "book",
            "payment",
            "pay",
            "refund",
            "cancel",
            "agent",
            "human",
            "representative",
            "talk to",
            "speak to",
            "customer service",
        ]
        for kw in keywords:
            if kw in t:
                return True
        if intent:
            low = intent.lower()
            if any(x in low for x in ("purchase", "booking", "payment", "support", "handover", "human")):
                return True
        return False

    try:
        if _should_handover(incoming_text, detected_intent):
            # mark conversation as paused and persist an ai_event for auditing/notification
            conversation.is_bot_paused = True
            task = Task(
                entity_type="event",
                entity_id=conversation.id,
                assigned_user_id=conversation.assigned_user_id or inbox.workspace_id,
                title=f"Handover needed for {contact.name if contact and contact.name else conversation.id}",
                description=(
                    f"Customer message triggered handover. Intent={detected_intent or 'unknown'}. "
                    f"Conversation={conversation.id}."
                ),
                priority="high",
            )
            await evaluate_intelligence_alerts(
                session,
                workspace_id=inbox.workspace_id,
                lead=lead,
                conversation=conversation,
                text=incoming_text,
                intent=detected_intent,
                source="handover_trigger",
            )
            event = AIEvent(
                conversation_id=conversation.id,
                event_type="handover_trigger",
                payload={"reason": "heuristic", "text": incoming_text[:1000], "intent": detected_intent},
            )
            session.add(task)
            session.add(event)
            await session.flush()
            logger.info("[auto-reply] handover triggered for conversation=%s", conversation.id)
            return
    except Exception as exc:
        logger.debug("[auto-reply] handover check failed: %s", exc)

    missing_fields: list[str] = []
    if not (contact and contact.name) and not (lead and lead.contact_person):
        missing_fields.append("name")
    if not (lead and lead.email):
        missing_fields.append("email")

    async def _build_prompt(limit: int = 12) -> str:
        # fetch recent messages for context (most recent first)
        from sqlalchemy import select

        q = (
            select(Message)
            .where(Message.conversation_id == conversation.id)
            .order_by(Message.created_at.desc())
            .limit(limit)
        )
        res = await session.execute(q)
        recent = res.scalars().all()
        # reverse to chronological
        recent = list(reversed(recent))

        system_lines = [
            "You are a helpful, concise sales assistant that replies on behalf of the team.",
            "Use the conversation history for context and answer in a friendly professional tone.",
            conv_stage.system_prompt_instructions,
            "Keep the response brief and ask at most one clear follow-up question.",
        ]
        if detected_intent:
            system_lines.append(f"Detected customer intent: {detected_intent}.")
        if missing_fields:
            system_lines.append(f"Missing lead fields: {', '.join(missing_fields)}.")
        system = " ".join(system_lines)

        header = [f"System: {system}", "Conversation:"]
        tail = [f"User: {incoming_text.strip()}", "Assistant:"]
        conv_turns: list[str] = []

        for m in recent:
            role = "User" if m.sender_type == "contact" else "Assistant"
            content = (m.content or "").strip()
            if content:
                conv_turns.append(f"{role}: {content}")

        context_window = _model_context_window(llm.provider, model)
        reserved_reply_tokens = _reserved_reply_tokens(llm.provider, model)
        max_prompt_tokens = max(256, context_window - reserved_reply_tokens)

        def _assemble(turns: list[str]) -> str:
            return "\n".join(header + turns + tail)

        assembled = _assemble(conv_turns)
        while conv_turns and _estimate_tokens(assembled) > max_prompt_tokens:
            conv_turns.pop(0)
            assembled = _assemble(conv_turns)

        if _estimate_tokens(assembled) > max_prompt_tokens:
            # trim the final user message conservatively if the conversation is still too large
            incoming_budget = max_prompt_tokens - _estimate_tokens("\n".join(header + ["Assistant:"]))
            incoming_budget = max(64, incoming_budget)
            incoming_chars = incoming_budget * 4
            trimmed_incoming = incoming_text.strip()
            if len(trimmed_incoming) > incoming_chars:
                trimmed_incoming = trimmed_incoming[: max(0, incoming_chars - 3)] + "..."
            tail = [f"User: {trimmed_incoming}", "Assistant:"]
            assembled = _assemble(conv_turns)

        return assembled

    prompt = await _build_prompt(limit=12)

    provider = GroqProvider(api_key=api_key)
    try:
        reply = await provider.generate(model=model, prompt=prompt, max_tokens=300)
    except Exception as exc:
        logger.error("[auto-reply] Groq generate failed: %s", exc, exc_info=True)
        return

    # send reply via channel adapter
    try:
        channel_cfg = decrypt_channel_config(inbox.channel_config)
        result = await send_channel_message(conversation, reply, channel_cfg, contact)
    except Exception as exc:
        logger.error("[auto-reply] send_channel_message failed: %s", exc, exc_info=True)
        return

    # persist outgoing message
    out_msg = Message(
        conversation_id=conversation.id,
        content=reply,
        message_type="outgoing",
        sender_type="agent",
        sender_id=inbox.workspace_id,
        message_metadata={"auto_generated": True, "channel_result": result},
    )
    session.add(out_msg)
    conversation.last_message_at = datetime.now(timezone.utc)
    await session.flush()


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
            # attempt auto-reply in background (await here to keep it simple)
            try:
                await _maybe_auto_reply(session, conversation, contact, inbox, text)
            except Exception as exc:
                logger.error("[auto-reply] unhandled error: %s", exc, exc_info=True)
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
                try:
                    await _maybe_auto_reply(session, conversation, contact, inbox, body)
                except Exception as exc:
                    logger.error("[auto-reply] unhandled error: %s", exc, exc_info=True)
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
