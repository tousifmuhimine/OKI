import asyncio
import email
import imaplib
import smtplib
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import parseaddr
from typing import Any

from app.db.models import Contact, Conversation


def _send_smtp(
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None,
    subject: str | None = None,
) -> dict[str, Any]:
    if not contact or not contact.email:
        raise ValueError("Email messages require a contact email")

    host = channel_config.get("smtp_host")
    port = int(channel_config.get("smtp_port") or 587)
    username = channel_config.get("smtp_username")
    password = channel_config.get("smtp_password")
    sender = channel_config.get("from_email") or username
    use_tls = bool(channel_config.get("use_tls", True))

    if not host or not username or not password or not sender:
        raise ValueError("Email channel is missing SMTP host, username, password, or sender")

    email = EmailMessage()
    email["From"] = sender
    email["To"] = contact.email
    email["Subject"] = subject or channel_config.get("subject") or "Message from OKI CRM"
    email.set_content(message_text)

    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=20) as smtp:
            smtp.login(username, password)
            smtp.send_message(email)
    else:
        with smtplib.SMTP(host, port, timeout=20) as smtp:
            if use_tls:
                smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(email)

    return {"provider": "email", "to": contact.email, "subject": email["Subject"]}


async def send_message(
    conversation: Conversation,
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact | None = None,
) -> dict[str, Any]:
    return await asyncio.to_thread(_send_smtp, message_text, channel_config, contact, None)


async def send_direct_message(
    message_text: str,
    channel_config: dict[str, Any],
    contact: Contact,
    subject: str | None = None,
) -> dict[str, Any]:
    return await asyncio.to_thread(_send_smtp, message_text, channel_config, contact, subject)


def _text_from_message(message: email.message.Message) -> str:
    if message.is_multipart():
        for part in message.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition") or "")
            if content_type == "text/plain" and "attachment" not in disposition:
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace").strip()
    payload = message.get_payload(decode=True)
    if payload:
        charset = message.get_content_charset() or "utf-8"
        return payload.decode(charset, errors="replace").strip()
    return str(message.get_payload() or "").strip()


def _decode_header_value(value: str | None) -> str:
    if not value:
        return ""
    return str(make_header(decode_header(value)))


def _fetch_imap(channel_config: dict[str, Any], limit: int) -> list[dict[str, Any]]:
    host = channel_config.get("imap_host")
    port = int(channel_config.get("imap_port") or 993)
    username = channel_config.get("imap_username") or channel_config.get("smtp_username")
    password = channel_config.get("imap_password") or channel_config.get("smtp_password")
    mailbox = channel_config.get("imap_mailbox") or "INBOX"
    use_ssl = bool(channel_config.get("imap_use_ssl", True))

    if not host or not username or not password:
        raise ValueError("Email channel is missing IMAP host, username, or password")

    client_cls = imaplib.IMAP4_SSL if use_ssl else imaplib.IMAP4
    with client_cls(host, port) as imap:
        imap.login(username, password)
        imap.select(mailbox)
        status, data = imap.uid("search", None, "ALL")
        if status != "OK":
            raise ValueError("Could not search mailbox")

        uids = data[0].split()[-limit:]
        messages: list[dict[str, Any]] = []
        for uid_bytes in uids:
            uid = uid_bytes.decode("ascii", errors="ignore")
            status, fetched = imap.uid("fetch", uid, "(BODY.PEEK[])")
            if status != "OK" or not fetched:
                continue
            raw = next((item[1] for item in fetched if isinstance(item, tuple)), None)
            if not raw:
                continue

            parsed = email.message_from_bytes(raw)
            name, address = parseaddr(_decode_header_value(parsed.get("From")))
            subject = _decode_header_value(parsed.get("Subject"))
            body = _text_from_message(parsed)
            messages.append(
                {
                    "uid": uid,
                    "message_id": parsed.get("Message-ID") or uid,
                    "from_name": name or address or "Unknown sender",
                    "from_email": address or None,
                    "subject": subject,
                    "body": body,
                }
            )
        return messages


async def fetch_messages(channel_config: dict[str, Any], limit: int = 25) -> list[dict[str, Any]]:
    return await asyncio.to_thread(_fetch_imap, channel_config, limit)
