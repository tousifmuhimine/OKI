from typing import Any

from app.db.models import Contact, Conversation


async def send_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    return {
        "provider": conversation.channel_type,
        "queued": True,
        "delivery": "websocket_pending",
    }
