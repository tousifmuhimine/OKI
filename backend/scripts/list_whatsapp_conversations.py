import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Conversation, Contact, Inbox
from app.inbox.security import decrypt_channel_config

async def main():
    async with SessionLocal() as session:
        # Get all WhatsApp conversations
        result = await session.execute(
            select(Conversation, Contact, Inbox)
            .join(Inbox, Inbox.id == Conversation.inbox_id)
            .join(Contact, Contact.id == Conversation.contact_id)
            .where(Conversation.channel_type == 'whatsapp')
            .order_by(Conversation.created_at.desc())
            .limit(10)
        )
        rows = result.all()
        print('Total WhatsApp conversations: {}'.format(len(rows)))
        for conv, contact, inbox in rows:
            cfg = decrypt_channel_config(inbox.channel_config)
            token = cfg.get('api_token', '')
            print('Contact: {} | Inbox: {} ({})'.format(contact.name, inbox.name, inbox.id))
            print('  Token: {}...'.format(token[:30]))
            print()

if __name__ == '__main__':
    asyncio.run(main())
