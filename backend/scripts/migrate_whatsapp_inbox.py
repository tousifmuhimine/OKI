import asyncio
import json
import os
from sqlalchemy import select, text
from app.db.session import SessionLocal
from app.db.models import Inbox, Conversation, Message, Contact

NEW_WS = 'a31c8d90-ab44-4001-a9ee-3a513156a6bd'
OLD_WS = 'dev-user'
INBOX_ID = 'a02be3b8-6996-41ab-a8cb-de3db65a7344'
BACKUP_DIR = 'backups'

os.makedirs(BACKUP_DIR, exist_ok=True)

async def main():
    async with SessionLocal() as session:
        inbox = await session.get(Inbox, INBOX_ID)
        conv_result = await session.execute(select(Conversation).where(Conversation.inbox_id == INBOX_ID))
        convs = conv_result.scalars().all()
        conv_ids = [c.id for c in convs]
        msg_rows = []
        if conv_ids:
            msg_result = await session.execute(select(Message).where(Message.conversation_id.in_(conv_ids)).order_by(Message.created_at))
            msg_rows = msg_result.scalars().all()
        contact_ids = list({c.contact_id for c in convs})
        contacts = []
        if contact_ids:
            contact_result = await session.execute(select(Contact).where(Contact.id.in_(contact_ids)))
            contacts = contact_result.scalars().all()

        def orm_to_dict(obj):
            if obj is None:
                return None
            data = {}
            for col in obj.__table__.columns:
                val = getattr(obj, col.name)
                try:
                    json.dumps(val)
                    data[col.name] = val
                except Exception:
                    data[col.name] = str(val)
            return data

        backup = {
            'inbox': orm_to_dict(inbox),
            'conversations': [orm_to_dict(c) for c in convs],
            'contacts': [orm_to_dict(c) for c in contacts],
            'messages': [orm_to_dict(m) for m in msg_rows],
        }

        backup_path = os.path.join(BACKUP_DIR, 'migration_backup_whatsapp_{}.json'.format(INBOX_ID))
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(backup, f, indent=2, ensure_ascii=False)
        print('backup_written', backup_path)

        # Perform migration updates
        await session.execute(text("UPDATE inboxes SET workspace_id = :new WHERE id = :id AND workspace_id = :old"), {'new': NEW_WS, 'id': INBOX_ID, 'old': OLD_WS})
        for cid in contact_ids:
            await session.execute(text("UPDATE contacts SET workspace_id = :new WHERE id = :cid AND workspace_id = :old"), {'new': NEW_WS, 'cid': cid, 'old': OLD_WS})
        for conv in convs:
            await session.execute(text("UPDATE conversations SET workspace_id = :new WHERE id = :conv_id AND workspace_id = :old"), {'new': NEW_WS, 'conv_id': conv.id, 'old': OLD_WS})
        for conv_id in conv_ids:
            await session.execute(text("UPDATE messages SET sender_id = :new WHERE conversation_id = :conv_id AND sender_type = 'agent' AND sender_id = :old"), {'new': NEW_WS, 'conv_id': conv_id, 'old': OLD_WS})

        await session.commit()
        print('migration-complete')

        # Verification prints
        v_inbox = await session.get(Inbox, INBOX_ID)
        print('inbox_workspace_after=', v_inbox.workspace_id if v_inbox else None)
        convs_after = (await session.execute(select(Conversation).where(Conversation.inbox_id == INBOX_ID))).scalars().all()
        print('conversations_after_count=', len(convs_after))
        for c in convs_after:
            print('conv', c.id, 'ws', c.workspace_id)
        msgs_after = (await session.execute(select(Message).where(Message.conversation_id.in_(conv_ids)).order_by(Message.created_at))).scalars().all() if conv_ids else []
        print('messages_after_count=', len(msgs_after))
        for m in msgs_after:
            print('msg', m.id, 'sender_type', m.sender_type, 'sender_id', m.sender_id)

if __name__ == '__main__':
    asyncio.run(main())
