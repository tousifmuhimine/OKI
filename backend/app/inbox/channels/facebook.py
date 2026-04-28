from typing import Any

import httpx

from app.db.models import Contact, Conversation


GRAPH_API_VERSION = "v19.0"


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
