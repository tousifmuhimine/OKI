import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Inbox, Conversation
from app.inbox.security import decrypt_channel_config

async def main():
    async with SessionLocal() as session:
        inboxes = (await session.execute(select(Inbox).where(Inbox.channel_type == 'whatsapp').order_by(Inbox.created_at.desc()))).scalars().all()
        print('whatsapp_inboxes={}'.format(len(inboxes)))
        for inbox in inboxes:
            cfg = decrypt_channel_config(inbox.channel_config)
            conv_count = (await session.execute(select(Conversation.id).where(Conversation.inbox_id == inbox.id))).scalars().all()
            print('---')
            print('inbox_id={} name={} workspace_id={}'.format(inbox.id, inbox.name, inbox.workspace_id))
            print('integration_mode={} phone_number_id={}'.format(cfg.get('integration_mode'), cfg.get('phone_number_id')))
            print('token_prefix={}'.format((cfg.get('api_token') or '')[:30]))
            print('conversation_count={}'.format(len(conv_count)))

if __name__ == '__main__':
    asyncio.run(main())
