#!/usr/bin/env python
"""Find real inbox phone_number_id from database"""
import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def main():
    async with SessionLocal() as session:
        result = await session.execute(
            text("SELECT id, channel_type, channel_config FROM inboxes LIMIT 5;")
        )
        inboxes = result.fetchall()
        if inboxes:
            for idx, (inbox_id, channel_type, config) in enumerate(inboxes, 1):
                print(f"\n--- Inbox #{idx} ---")
                print(f"ID: {inbox_id}")
                print(f"Type: {channel_type}")
                print(f"Config: {config}")
        else:
            print("No inboxes found!")

asyncio.run(main())
