from typing import Any

from app.db.models import Contact, Conversation
from app.inbox.channels import email, facebook, instagram, website, whatsapp


class ChannelSendError(Exception):
    pass


async def send_channel_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    if conversation.channel_type == "facebook":
        return await facebook.send_message(conversation, message_text, channel_config, contact)
    if conversation.channel_type == "instagram":
        return await instagram.send_message(conversation, message_text, channel_config, contact)
    if conversation.channel_type == "whatsapp":
        return await whatsapp.send_message(conversation, message_text, channel_config, contact)
    if conversation.channel_type == "email":
        return await email.send_message(conversation, message_text, channel_config, contact)
    if conversation.channel_type in {"website", "api"}:
        return await website.send_message(conversation, message_text, channel_config, contact)

    raise ChannelSendError(f"Unsupported channel type: {conversation.channel_type}")
