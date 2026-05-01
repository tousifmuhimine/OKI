from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Contact, Conversation, Inbox, Message
from app.inbox.security import decrypt_channel_config


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


async def process_webhook(payload: dict[str, Any], db: AsyncSession) -> None:
    """
    Parses WhatsApp Cloud API webhook payloads and saves messages to the DB.
    """
    # Check if this is a messages payload
    entries = payload.get("entry", [])
    for entry in entries:
        changes = entry.get("changes", [])
        for change in changes:
            value = change.get("value", {})
            if "messages" not in value:
                continue

            # 1. Identify the Inbox
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id")
            if not phone_number_id:
                continue

            # Find inbox where channel_config->>'phone_number_id' == phone_number_id
            result = await db.execute(select(Inbox).where(Inbox.channel_type == "whatsapp"))
            inboxes = result.scalars().all()
            
            inbox = None
            for i in inboxes:
                decrypted_config = decrypt_channel_config(i.channel_config)
                if decrypted_config.get("phone_number_id") == phone_number_id:
                    inbox = i
                    break

            if not inbox:
                logger.warning(f"No inbox found for WhatsApp phone_number_id: {phone_number_id}")
                continue

            workspace_id = inbox.workspace_id

            # 2. Process Contacts and Messages
            contacts_data = value.get("contacts", [])
            messages_data = value.get("messages", [])

            for msg_data in messages_data:
                sender_phone = msg_data.get("from")
                if not sender_phone:
                    continue

                # Get contact name if available
                contact_name = sender_phone
                for c in contacts_data:
                    if c.get("wa_id") == sender_phone:
                        contact_name = c.get("profile", {}).get("name") or sender_phone
                        break

                # Find or create contact
                result = await db.execute(
                    select(Contact).where(
                        Contact.workspace_id == workspace_id,
                        Contact.phone == sender_phone
                    )
                )
                contact = result.scalar_one_or_none()

                if not contact:
                    contact = Contact(
                        workspace_id=workspace_id,
                        name=contact_name,
                        phone=sender_phone,
                        channel_identifiers={"whatsapp": sender_phone},
                    )
                    db.add(contact)
                    await db.flush()

                # Find or create conversation
                result = await db.execute(
                    select(Conversation).where(
                        Conversation.inbox_id == inbox.id,
                        Conversation.contact_id == contact.id,
                        Conversation.status == "open"
                    )
                )
                conversation = result.scalar_one_or_none()

                if not conversation:
                    conversation = Conversation(
                        workspace_id=workspace_id,
                        inbox_id=inbox.id,
                        contact_id=contact.id,
                        channel_type="whatsapp",
                        status="open",
                    )
                    db.add(conversation)
                    await db.flush()

                # Create message
                content = ""
                msg_type = msg_data.get("type")
                if msg_type == "text":
                    content = msg_data.get("text", {}).get("body", "")
                elif msg_type == "button":
                    content = msg_data.get("button", {}).get("text", "")
                else:
                    content = f"[{msg_type} message]"

                message = Message(
                    conversation_id=conversation.id,
                    content=content,
                    message_type="incoming",
                    sender_type="contact",
                    sender_id=contact.id,
                    message_metadata=msg_data,
                )
                db.add(message)
                
                # Update conversation timestamp
                conversation.last_message_at = datetime.utcnow()

            await db.commit()
