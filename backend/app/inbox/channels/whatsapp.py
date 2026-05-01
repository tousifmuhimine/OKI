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
