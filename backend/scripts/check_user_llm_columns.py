import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def main():
    async with SessionLocal() as session:
        res = await session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='user_llm_configs'"))
        cols = [r[0] for r in res.fetchall()]
        print('columns:', cols)

if __name__ == '__main__':
    asyncio.run(main())
