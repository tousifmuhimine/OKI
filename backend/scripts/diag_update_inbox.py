import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

NEW_WS = 'a31c8d90-ab44-4001-a9ee-3a513156a6bd'
OLD_WS = 'dev-user'
INBOX_ID = 'a02be3b8-6996-41ab-a8cb-de3db65a7344'

async def main():
    async with SessionLocal() as s:
        r = await s.execute(text("SELECT workspace_id FROM inboxes WHERE id = :id"), {'id': INBOX_ID})
        print('before', r.mappings().first())
        res = await s.execute(text("UPDATE inboxes SET workspace_id = :new WHERE id = :id AND workspace_id = :old RETURNING workspace_id"), {'new': NEW_WS, 'id': INBOX_ID, 'old': OLD_WS})
        rows = res.mappings().all()
        print('updated rows', len(rows), rows)
        await s.commit()
        r2 = await s.execute(text("SELECT workspace_id FROM inboxes WHERE id = :id"), {'id': INBOX_ID})
        print('after', r2.mappings().first())

if __name__ == '__main__':
    asyncio.run(main())
