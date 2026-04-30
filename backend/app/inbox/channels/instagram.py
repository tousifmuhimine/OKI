from typing import Any

import httpx

from app.db.models import Contact, Conversation


GRAPH_API_VERSION = "v19.0"


def _is_sandbox(channel_config: dict[str, Any]) -> bool:
    return channel_config.get("integration_mode") == "sandbox"


def _recipient_id(contact: Contact | None) -> str:
    if not contact:
        raise ValueError("Instagram messages require a contact")
    recipient = contact.channel_identifiers.get("instagram_id") or contact.channel_identifiers.get("ig_scoped_user_id")
    if not recipient:
        raise ValueError("Instagram contact is missing instagram_id or ig_scoped_user_id")
    return str(recipient)


async def send_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    if _is_sandbox(channel_config):
        return {
            "provider": "instagram",
            "mode": "sandbox",
            "response": {
                "message_id": f"sandbox-instagram-{conversation.id}",
                "recipient_id": _recipient_id(contact) if contact else None,
                "preview": message_text[:120],
            },
        }

    page_access_token = channel_config.get("page_access_token")
    page_id = channel_config.get("page_id")
    if not page_access_token or not page_id:
        raise ValueError("Instagram channel is missing page_access_token or page_id")

    url = f"https://graph.facebook.com/{GRAPH_API_VERSION}/{page_id}/messages"
    payload = {
        "recipient": {"id": _recipient_id(contact)},
        "message": {"text": message_text},
    }

    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, params={"access_token": page_access_token}, json=payload)
        response.raise_for_status()

    return {"provider": "instagram", "response": response.json()}
