#!/usr/bin/env python
"""Decrypt inbox config to find phone_number_id"""
import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal
from app.inbox.security import decrypt_channel_config

async def main():
    async with SessionLocal() as session:
        result = await session.execute(
            text("SELECT id, channel_type, channel_config FROM inboxes WHERE id = 'c60e70a4-23b1-4ea7-ba70-dae932940960';")
        )
        inbox = result.fetchone()
        if inbox:
            inbox_id, channel_type, config = inbox
            print(f"Inbox ID: {inbox_id}")
            print(f"Channel: {channel_type}")
            try:
                decrypted = decrypt_channel_config(config)
                print(f"Config (decrypted): {decrypted}")
                if isinstance(decrypted, dict):
                    print(f"phone_number_id: {decrypted.get('phone_number_id', 'NOT FOUND')}")
            except Exception as e:
                print(f"Failed to decrypt: {e}")
        else:
            print("Inbox not found")

asyncio.run(main())
