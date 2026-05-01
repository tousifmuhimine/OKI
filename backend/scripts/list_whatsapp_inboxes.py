import asyncio
from app.db.session import SessionLocal
from app.db.models import Inbox
from app.inbox.security import decrypt_channel_config
from sqlalchemy import select

WS = 'a31c8d90-ab44-4001-a9ee-3a513156a6bd'

async def main():
    async with SessionLocal() as session:
        result = await session.execute(select(Inbox).where(Inbox.workspace_id == WS, Inbox.channel_type == 'whatsapp'))
        inboxes = result.scalars().all()
        print('count={}'.format(len(inboxes)))
        for inbox in inboxes:
            cfg = decrypt_channel_config(inbox.channel_config)
            print('inbox_id={}, name={}'.format(inbox.id, inbox.name))
            token = cfg.get('api_token', '')
            print('  phone_number_id={}'.format(cfg.get('phone_number_id')))
            print('  api_token={}...'.format(token[:50] if token else 'None'))
            print('  integration_mode={}'.format(cfg.get('integration_mode')))
            print()

if __name__ == '__main__':
    asyncio.run(main())
