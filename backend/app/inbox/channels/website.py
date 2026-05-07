from typing import Any
import logging

from app.db.models import Contact, Conversation
from app.inbox.ws_hub import broadcast

logger = logging.getLogger(__name__)


async def send_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    """Stub: attempt to emit message over an in-process websocket hub.

    For now this function logs the outgoing payload and returns a delivery
    placeholder. Later we will wire this to a real websocket broadcaster
    or Supabase Realtime.
    """
    try:
        payload = {"conversation_id": conversation.id, "text": message_text}
        logger.info("[website.send_message] emit: %s", payload)
        # publish to websocket hub; best-effort fire-and-forget
        try:
            await broadcast(conversation.id, payload)
            return {"provider": conversation.channel_type, "queued": True, "delivery": "websocket_emitted"}
        except Exception:
            logger.exception("[website.send_message] broadcast failed")
            return {"provider": conversation.channel_type, "queued": True, "delivery": "websocket_pending"}
    except Exception as exc:
        logger.exception("[website.send_message] failed: %s", exc)
        return {"provider": conversation.channel_type, "queued": False, "delivery": "error"}
