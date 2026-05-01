Paste the entire content below to Claude. It contains environment, code files, observed outputs, diagnostics, and exact test commands/payloads.

---
You are an expert backend/debugging engineer. I need you to debug and provide a minimal, actionable plan (checks + code changes or commands) so that the chatbot auto-reply works for Messenger and WhatsApp in my local dev environment.

Summary / environment
- OS: Windows, dev machine.
- Backend: FastAPI async, SQLAlchemy async (asyncpg), Alembic migrations, Python venv. Run server at `http://localhost:8000` (uvicorn).
- Frontend: Next.js (app router), dev on `http://localhost:3000`.
- LLM provider: Groq adapter implemented in backend code.
- DB: PostgreSQL, table `user_llm_configs` stores provider config (encrypted API key), `automation_modes` JSONB column exists.
- Dev auth: `X-Dev-Workspace-Id` header is used for a dev workspace id.

What currently works / recent actions
- Migrations applied so `automation_modes` column exists.
- Groq model allowlist and frontend model list updated.
- Delete endpoint and UI added to remove stale Groq configs.
- I used a PowerShell script to delete an old Groq row and create a new minimal Groq config:
  - Created config id: `9e7e6114-ed4b-46d3-b911-e4ebee060e0d`
  - Payload used: `provider: "groq"`, `default_model: "llama-3.1-8b-instant"`, `automation_modes: { "whatsapp":"chatbot", "messenger":"chatbot" }`, `api_key: "REPLACE_ME"`.
- `GET /api/v1/health/chatbot` returns `status: "ok"`, `chatbot_enabled: true`, `model_valid: true`.

Observed failure
- Even after creating the Groq config, the bot does not send auto-replies to Messenger or WhatsApp messages.

Likely root causes to check
1. Groq config API key is placeholder or invalid.
2. Channel outbound configuration (Facebook/WhatsApp tokens) missing or invalid.
3. `_maybe_auto_reply()` selection logic or prompt building is wrong.
4. Exceptions are swallowed and not visible in logs.

Files (copy the code blocks below to inspect locally)

---
File: backend/app/inbox/routers/channels.py

```py
from datetime import datetime, timezone
from typing import Any, Iterable
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_session_dep
from app.core.config import settings
from app.db.models import Contact, Conversation, Inbox, Message
from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import DEFAULT_GROQ_MODEL
from app.inbox.security import decrypt_channel_config
from app.schemas.inbox import WebhookAck
from app.inbox.llm_providers.groq import GroqProvider
from app.inbox.channels import send_channel_message
from app.inbox.security import decrypt_channel_config as decrypt_user_config


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
    # map conversation.channel_type to front-end channel keys
    if conversation.channel_type == "whatsapp":
        platform_key = "whatsapp"
    elif conversation.channel_type == "email":
        platform_key = "email"
    else:
        # facebook / instagram -> messenger
        platform_key = "messenger"

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

        system = (
            "You are a helpful, concise assistant that replies on behalf of the support agent. "
            "Use the conversation history for context and answer in a friendly professional tone."
        )

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
    except Exception:
        return

    # send reply via channel adapter
    try:
        channel_cfg = decrypt_channel_config(inbox.channel_config)
        result = await send_channel_message(conversation, reply, channel_cfg, contact)
    except Exception:
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
            stats["processed"] += 1
            # attempt auto-reply in background (await here to keep it simple)
            try:
                await _maybe_auto_reply(session, conversation, contact, inbox, text)
            except Exception:
                pass
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
                stats["processed"] += 1
                try:
                    await _maybe_auto_reply(session, conversation, contact, inbox, body)
                except Exception:
                    pass
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
```

---
File: backend/app/inbox/llm_providers/groq.py

```py
from typing import Any
import httpx

GROQ_API_BASE = "https://api.groq.ai/v1"

# Keep this list aligned with Groq's supported production models.
SUPPORTED_GROQ_MODELS = (
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
)

DEFAULT_GROQ_MODEL = SUPPORTED_GROQ_MODELS[0]


class GroqProvider:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, model: str, prompt: str, max_tokens: int = 512) -> str:
        url = f"{GROQ_API_BASE}/models/{model}/completions"
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        json = {"prompt": prompt, "max_tokens": max_tokens}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=json)
            resp.raise_for_status()
            body = resp.json()

        # Groq responses vary; try to extract text safely
        if isinstance(body, dict):
            # common shape: {"choices": [{"text": "..."}]}
            choices = body.get("choices") or []
            if choices and isinstance(choices, list):
                first = choices[0]
                return first.get("text") or first.get("output") or ""

        return str(body)
```

---
File: backend/app/inbox/routers/ai.py

```py
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import SUPPORTED_GROQ_MODELS
from app.inbox.security import encrypt_channel_config, summarize_channel_config
from app.schemas.llm import UserLLMConfigCreate, UserLLMConfigRead


router = APIRouter()


def _validate_groq_models(payload: UserLLMConfigCreate) -> None:
    if payload.provider != "groq":
        return

    allowed = set(SUPPORTED_GROQ_MODELS)
    invalid_models: list[str] = []

    if payload.default_model and payload.default_model not in allowed:
        invalid_models.append(payload.default_model)

    for model in (payload.model_preferences or {}).values():
        if model and model not in allowed and model not in invalid_models:
            invalid_models.append(model)

    if invalid_models:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported Groq model(s): "
                + ", ".join(sorted(invalid_models))
                + ". Use one of: "
                + ", ".join(SUPPORTED_GROQ_MODELS)
            ),
        )


@router.get("/config", response_model=list[UserLLMConfigRead])
async def list_configs(
    auth: AuthContext = Depends(get_current_auth), session: AsyncSession = Depends(get_session_dep)
):
    q = select(UserLLMConfig).where(UserLLMConfig.user_id == auth.user_id)
    res = await session.execute(q)
    rows = res.scalars().all()

    # mask encrypted config when returning
    results = []
    for r in rows:
        results.append(UserLLMConfigRead(
            id=r.id,
            provider=r.provider,
            default_model=r.default_model,
            model_preferences=r.model_preferences or {},
            automation_modes=r.automation_modes or {},
        ))

    return results


@router.post("/config", response_model=UserLLMConfigRead)
async def upsert_config(
    payload: UserLLMConfigCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    _validate_groq_models(payload)

    # encrypt api key and optional api_url using channel config cipher
    cfg: dict[str, str] = {"api_key": payload.api_key}
    if getattr(payload, "api_url", None):
        cfg["api_url"] = payload.api_url
    enc = encrypt_channel_config(cfg)

    # try update existing record for same provider & user
    q = select(UserLLMConfig).where(
        UserLLMConfig.user_id == auth.user_id, UserLLMConfig.provider == payload.provider
    )
    res = await session.execute(q)
    existing = res.scalar_one_or_none()

    if existing:
        stmt = (
            update(UserLLMConfig)
            .where(UserLLMConfig.id == existing.id)
            .values(
                encrypted_config=enc,
                default_model=payload.default_model,
                model_preferences=payload.model_preferences or {},
                automation_modes=payload.automation_modes or {},
            )
        )
        await session.execute(stmt)
        await session.commit()
        existing.encrypted_config = enc
        existing.default_model = payload.default_model
        existing.model_preferences = payload.model_preferences or {}
        existing.automation_modes = payload.automation_modes or {}
        r = existing
    else:
        r = UserLLMConfig(
            workspace_id=auth.user_id,
            user_id=auth.user_id,
            provider=payload.provider,
            encrypted_config=enc,
            default_model=payload.default_model,
            model_preferences=payload.model_preferences or {},
            automation_modes=payload.automation_modes or {},
        )
        session.add(r)
        await session.commit()
        await session.refresh(r)

    return UserLLMConfigRead(
        id=r.id,
        provider=r.provider,
        default_model=r.default_model,
        model_preferences=r.model_preferences or {},
        automation_modes=r.automation_modes or {},
    )


@router.delete("/config/{config_id}")
async def delete_config(
    config_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    q = select(UserLLMConfig).where(
        UserLLMConfig.id == config_id,
        UserLLMConfig.user_id == auth.user_id,
    )
    res = await session.execute(q)
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Config not found")

    await session.delete(existing)
    await session.commit()
    return {"deleted": True, "id": config_id}
```

---
File: backend/app/api/routes/health.py

```py
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import SUPPORTED_GROQ_MODELS


router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/chatbot")
async def chatbot_health_check(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> dict[str, object]:
    q = select(UserLLMConfig).where(UserLLMConfig.user_id == auth.user_id)
    res = await session.execute(q)
    configs = res.scalars().all()

    messenger_configs = [cfg for cfg in configs if (cfg.automation_modes or {}).get("messenger") == "chatbot"]
    ready_config = None
    for cfg in messenger_configs:
        if cfg.default_model and (cfg.provider != "groq" or cfg.default_model in SUPPORTED_GROQ_MODELS):
            ready_config = cfg
            break

    return {
        "status": "ok" if ready_config else "not_ready",
        "workspace_id": auth.user_id,
        "config_count": len(configs),
        "chatbot_enabled": bool(messenger_configs),
        "model_configured": bool(ready_config and ready_config.default_model),
        "provider": ready_config.provider if ready_config else None,
        "model": ready_config.default_model if ready_config else None,
        "model_valid": bool(
            ready_config and (ready_config.provider != "groq" or ready_config.default_model in SUPPORTED_GROQ_MODELS)
        ),
    }
```

---
File: backend/app/inbox/channels/whatsapp.py

```py
from typing import Any

import httpx

from app.db.models import Contact, Conversation


GRAPH_API_VERSION = "v19.0"


def _is_sandbox(channel_config: dict[str, Any]) -> bool:
    return channel_config.get("integration_mode") == "sandbox"


def _phone_number(contact: Contact | None) -> str:
    if not contact:
        raise ValueError("WhatsApp messages require a contact")
    phone = contact.channel_identifiers.get("whatsapp") or contact.phone
    if not phone:
        raise ValueError("WhatsApp contact is missing phone or channel_identifiers.whatsapp")
    return str(phone)


async def send_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    if _is_sandbox(channel_config):
        return {
            "provider": "whatsapp",
            "mode": "sandbox",
            "response": {
                "message_id": f"sandbox-whatsapp-{conversation.id}",
                "recipient": _phone_number(contact) if contact else None,
                "preview": message_text[:120],
            },
        }

    api_token = channel_config.get("api_token")
    phone_number_id = channel_config.get("phone_number_id")
    if not api_token or not phone_number_id:
        raise ValueError("WhatsApp channel is missing api_token or phone_number_id")

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": _phone_number(contact),
        "type": "text",
        "text": {"preview_url": False, "body": message_text},
    }
    headers = {"Authorization": f"Bearer {api_token}"}

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
    except httpx.HTTPStatusError as exc:
        try:
            error_data = exc.response.json()
            error_msg = error_data.get("error", {}).get("message", str(exc))
        except Exception:
            error_msg = f"HTTP {exc.response.status_code}: {exc.response.text}"
        raise ValueError(f"WhatsApp API error: {error_msg}") from exc
    except httpx.RequestError as exc:
        raise ValueError(f"WhatsApp API request failed: {str(exc)}") from exc

    return {"provider": "whatsapp", "response": response.json()}
```

---
File: backend/app/inbox/channels/facebook.py

```py
from typing import Any

import httpx

from app.db.models import Contact, Conversation


GRAPH_API_VERSION = "v19.0"


def _is_sandbox(channel_config: dict[str, Any]) -> bool:
    return channel_config.get("integration_mode") == "sandbox"


def _recipient_id(contact: Contact | None) -> str:
    if not contact:
        raise ValueError("Facebook messages require a contact")
    recipient = contact.channel_identifiers.get("facebook_id") or contact.channel_identifiers.get("psid")
    if not recipient:
        raise ValueError("Facebook contact is missing facebook_id or psid")
    return str(recipient)


async def send_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    if _is_sandbox(channel_config):
        return {
            "provider": "facebook",
            "mode": "sandbox",
            "response": {
                "message_id": f"sandbox-facebook-{conversation.id}",
                "recipient_id": _recipient_id(contact) if contact else None,
                "preview": message_text[:120],
            },
        }

    page_access_token = channel_config.get("page_access_token")
    page_id = channel_config.get("page_id")
    if not page_access_token or not page_id:
        raise ValueError("Facebook channel is missing page_access_token or page_id")

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{page_id}/messages"
    payload = {
        "recipient": {"id": _recipient_id(contact)},
        "message": {"text": message_text},
        "messaging_type": "RESPONSE",
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, params={"access_token": page_access_token}, json=payload)
        response.raise_for_status()

    return {"provider": "facebook", "response": response.json()}
```

---

Observed command outputs (from my environment):

`GET /api/v1/ai/config` (with header `X-Dev-Workspace-Id: a31c8d90-ab44-4001-a9ee-3a513156a6bd`):

```json
{
  "value": [
    {
      "id": "9e7e6114-ed4b-46d3-b911-e4ebee060e0d",
      "provider": "groq",
      "default_model": "llama-3.1-8b-instant",
      "model_preferences": {},
      "automation_modes": { "email":"manual","whatsapp":"chatbot","messenger":"chatbot" }
    }
  ],
  "Count": 1
}
```

`GET /api/v1/health/chatbot` (same header):

```json
{
  "status": "ok",
  "workspace_id": "a31c8d90-ab44-4001-a9ee-3a513156a6bd",
  "config_count": 1,
  "chatbot_enabled": true,
  "model_configured": true,
  "provider": "groq",
  "model": "llama-3.1-8b-instant",
  "model_valid": true
}
```


Diagnostics checklist (prioritized)
1. Verify saved Groq config contains a real API key and decrypts correctly.
   - Command (PowerShell):

```powershell
$h=@{ 'X-Dev-Workspace-Id'='a31c8d90-ab44-4001-a9ee-3a513156a6bd' }
Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/config' -Headers $h -Method Get | ConvertTo-Json -Depth 5
```

2. Confirm health endpoint shows `chatbot_enabled: true` and `model_valid: true` (already true here).

3. Enable verbose logging (or tail uvicorn console) and send a test incoming message to the ingestion endpoint. Observe logs for:
   - `_maybe_auto_reply()` being called
   - `GroqProvider.generate()` invoked with decrypted API key and model
   - Any exceptions or Graph API errors from `send_message` adapters

4. Check inbox `channel_config` records for `phone_number_id` and `api_token` (WhatsApp) or `page_access_token`/`page_id` (Facebook).
   - SQL: `SELECT channel_config FROM inboxes WHERE channel_type IN ('whatsapp','facebook');`
   - Or run script `scripts/list_whatsapp_inboxes.py` if available.

5. Simulate Groq call with saved API key directly to confirm provider responds.

6. If Groq call OK and channel config valid, POST a test webhook to the app to verify send path is attempted and persists outgoing message.

Concrete fixes to propose if issues found
- If Groq key missing: update via UI or POST `POST /api/v1/ai/config` with real `api_key`.
- If selection logic buggy: prefer configs where `automation_modes[platform]=='chatbot'` and `provider=='groq'`, log chosen config id.
- If Groq returns HTTP errors: improve logging in `groq.py` to include response body/status and bubble exceptions.
- If `send_message` fails: log Graph API request and response details.
- Add an end-to-end test script to simulate inbound and verify outbound insertion in `messages` table.

Minimal commands to run now

- Check configs:

```powershell
$h=@{ 'X-Dev-Workspace-Id'='a31c8d90-ab44-4001-a9ee-3a513156a6bd' }
Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/ai/config' -Headers $h -Method Get | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/health/chatbot' -Headers $h -Method Get | ConvertTo-Json -Depth 5
```

- Simulate WhatsApp incoming webhook (PowerShell example):

```powershell
$payload = Get-Content .\sample_whatsapp_payload.json -Raw
Invoke-RestMethod -Uri 'http://localhost:8000/api/v1/inbox/webhooks/whatsapp' -Method Post -Headers @{ 'Content-Type'='application/json' } -Body $payload
```

Sample WhatsApp webhook payload (save as `sample_whatsapp_payload.json`):

```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "metadata": { "phone_number_id": "1234567890" },
            "messages": [
              {
                "id": "wamid.HBgM...",
                "from": "15551234567",
                "timestamp": "1670000000",
                "text": { "body": "Hello, I have a question about my order." }
              }
            ],
            "contacts": [
              {"wa_id": "15551234567", "profile": {"name": "Test User"}}
            ]
          }
        }
      ]
    }
  ]
}
```

Notes about payload shape: the app expects `entry -> changes -> value` and in `value` a `metadata.phone_number_id`, `messages` array with `text.body` and `contacts` array with `wa_id` and optional `profile.name`.

What I want from Claude (explicit asks)
1. Provide a prioritized step-by-step debug checklist with exact commands to run and what to look for in logs/output.
2. Suggest minimal single-function code changes (file and function references) to make auto-reply more observable and fail loudly (e.g., add `logger.info` lines and rethrow exceptions).
3. If applicable, provide small patch snippets that can be applied directly.
4. Describe where to safely insert real Groq API key and how to test without committing keys.
5. Provide a minimal end-to-end test script (Python or PowerShell/curl) to validate auto-reply end-to-end.

Extra files & helpful scripts to inspect locally
- `backend/app/inbox/routers/channels.py` — focus on `_maybe_auto_reply()` and `_ingest_whatsapp_payload()`
- `backend/app/inbox/llm_providers/groq.py` — `generate()` implementation
- `backend/app/inbox/routers/ai.py` — validation/whitelisting logic for saved models
- `backend/app/api/routes/health.py` — how health determines `chatbot_enabled` and `model_valid`
- `backend/app/inbox/channels/whatsapp.py` and `facebook.py` — `send_message` and response handling
- DB table `user_llm_configs`
- `scripts/check_user_llm_columns.py`

If you need specific terminal log outputs I captured earlier (including the ProgrammingError and PowerShell run results), ask and I'll paste them.

---

End of content to paste to Claude.
