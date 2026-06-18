import asyncio
import sys
import os

# Add parent directory to sys.path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.db.session import engine

async def add_column():
    async with engine.begin() as conn:
        print("Adding lead_ids column to lead_share_links if it doesn't exist...")
        await conn.execute(text("ALTER TABLE lead_share_links ADD COLUMN IF NOT EXISTS lead_ids JSONB DEFAULT '[]'::jsonb;"))
        print("Schema migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(add_column())
