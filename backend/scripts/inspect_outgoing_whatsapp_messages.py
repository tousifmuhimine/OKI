import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Message, Conversation, Inbox, Contact
from app.inbox.security import decrypt_channel_config

async def main():
    async with SessionLocal() as session:
        stmt = (
            select(Message, Conversation, Inbox, Contact)
            .join(Conversation, Conversation.id == Message.conversation_id)
            .join(Inbox, Inbox.id == Conversation.inbox_id)
            .join(Contact, Contact.id == Conversation.contact_id)
            .where(Conversation.channel_type == 'whatsapp', Message.message_type == 'outgoing')
            .order_by(Message.created_at.desc())
            .limit(20)
        )
        rows = (await session.execute(stmt)).all()
        print('outgoing_whatsapp_count={}'.format(len(rows)))
        for msg, conv, inbox, contact in rows:
            cfg = decrypt_channel_config(inbox.channel_config)
            cr = msg.message_metadata.get('channel_result') if isinstance(msg.message_metadata, dict) else None
            mode = cr.get('mode') if isinstance(cr, dict) else None
            provider = cr.get('provider') if isinstance(cr, dict) else None
            print('---')
            print('msg_id={} created_at={}'.format(msg.id, msg.created_at))
            print('content={}'.format(msg.content))
            print('contact={} ({})'.format(contact.name, contact.phone or contact.channel_identifiers.get('whatsapp')))
            print('inbox_id={} name={}'.format(inbox.id, inbox.name))
            print('integration_mode={}'.format(cfg.get('integration_mode')))
            print('token_prefix={}'.format((cfg.get('api_token') or '')[:30]))
            print('channel_result_mode={} provider={}'.format(mode, provider))

if __name__ == '__main__':
    asyncio.run(main())
