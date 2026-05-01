import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Inbox
from app.inbox.security import decrypt_channel_config, encrypt_channel_config

WORKSPACE_ID = 'a31c8d90-ab44-4001-a9ee-3a513156a6bd'

async def main():
    async with SessionLocal() as session:
        inbox = (
            await session.execute(
                select(Inbox).where(Inbox.workspace_id == WORKSPACE_ID, Inbox.channel_type == 'whatsapp').limit(1)
            )
        ).scalar_one_or_none()

        if not inbox:
            print('No WhatsApp inbox found')
            return

        cfg = decrypt_channel_config(inbox.channel_config)
        print('before_mode={}'.format(cfg.get('integration_mode')))

        cfg['integration_mode'] = 'live'
        inbox.channel_config = encrypt_channel_config(cfg)
        await session.commit()

        await session.refresh(inbox)
        after_cfg = decrypt_channel_config(inbox.channel_config)
        print('inbox_id={}'.format(inbox.id))
        print('after_mode={}'.format(after_cfg.get('integration_mode')))

if __name__ == '__main__':
    asyncio.run(main())
