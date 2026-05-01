import asyncio
import sys
import os

# Add the app directory to sys.path
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.db.models import Inbox
from sqlalchemy import select

async def check_inboxes():
    async with SessionLocal() as db:
        result = await db.execute(select(Inbox))
        inboxes = result.scalars().all()
        print(f"Total Inboxes found: {len(inboxes)}")
        for i in inboxes:
            print(f"--- Inbox: {i.name} ---")
            print(f"Type: {i.channel_type}")
            print(f"Config: {i.channel_config}")
            print("-----------------------")

if __name__ == "__main__":
    asyncio.run(check_inboxes())
