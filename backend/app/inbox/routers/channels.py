from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse

from app.api.deps import AuthContext, get_current_auth
from app.core.config import settings
from app.schemas.inbox import WebhookAck


router = APIRouter()


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
) -> WebhookAck:
    await _json_payload(request)
    return WebhookAck()


@router.post("/webhooks/whatsapp", response_model=WebhookAck)
async def receive_whatsapp_webhook(
    request: Request,
) -> WebhookAck:
    await _json_payload(request)
    return WebhookAck()


@router.post("/webhooks/email", response_model=WebhookAck)
async def receive_email_webhook(
    request: Request,
    _: AuthContext = Depends(get_current_auth),
) -> WebhookAck:
    await _json_payload(request)
    return WebhookAck()
