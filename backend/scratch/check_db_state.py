import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def check_db():
    engine = create_async_engine(settings.supabase_db_url)
    async with engine.connect() as conn:
        # Check alembic_version
        try:
            res = await conn.execute(text("SELECT version_num FROM alembic_version"))
            version = res.scalar()
            print(f"Current Alembic Version: {version}")
        except Exception as e:
            print(f"Alembic version table not found or error: {e}")

        # Check leads table columns
        try:
            res = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'"))
            columns = [row[0] for row in res.fetchall()]
            print(f"Leads table columns: {columns}")
        except Exception as e:
            print(f"Leads table error: {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())
