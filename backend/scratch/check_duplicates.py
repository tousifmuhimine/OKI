import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def check_duplicates():
    engine = create_async_engine(settings.supabase_db_url)
    async with engine.connect() as conn:
        try:
            query = """
            SELECT phone, COUNT(*), ARRAY_AGG(company_name) as names
            FROM leads
            WHERE phone IS NOT NULL AND phone != ''
            GROUP BY phone
            HAVING COUNT(*) > 1
            """
            res = await conn.execute(text(query))
            duplicates = res.fetchall()
            if duplicates:
                print("WARNING: Found duplicate phone numbers:")
                for row in duplicates:
                    print(f"   Phone: {row[0]}, Count: {row[1]}, Names: {row[2]}")
            else:
                print("OK: No duplicate phone numbers found in the database.")
        except Exception as e:
            print(f"Error querying duplicates: {e}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_duplicates())
