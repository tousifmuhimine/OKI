import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Conversation, Contact, Inbox
from app.inbox.security import decrypt_channel_config

async def main():
    async with SessionLocal() as session:
        # Get the conversation with Tousif Muhimine (from earlier incoming messages)
        result = await session.execute(
            select(Conversation, Inbox)
            .join(Inbox, Inbox.id == Conversation.inbox_id)
            .join(Contact, Contact.id == Conversation.contact_id)
            .where(Contact.name == 'Tousif Muhimine')
            .limit(1)
        )
        row = result.first()
        if row:
            conv, inbox = row
            cfg = decrypt_channel_config(inbox.channel_config)
            print('Conversation contact: Tousif Muhimine')
            print('Linked inbox_id: {}'.format(inbox.id))
            print('Inbox name: {}'.format(inbox.name))
            token = cfg.get('api_token', '')
            print('Token (first 50 chars): {}...'.format(token[:50]))
            print('Token length: {}'.format(len(token)))
            print('integration_mode: {}'.format(cfg.get('integration_mode')))
        else:
            print('No conversation found for Tousif Muhimine')

if __name__ == '__main__':
    asyncio.run(main())
