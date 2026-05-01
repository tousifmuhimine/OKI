import asyncio
import logging

from sqlalchemy import select
from app.core.config import settings
from app.db.models import Conversation, Contact, Inbox
from app.db.session import SessionLocal
from app.services.lead_capture import upsert_lead_from_inbound_message

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def backfill_leads():
    logger.info("Connecting to database to backfill leads from existing conversations...")
    async with SessionLocal() as session:
        # Get all conversations that don't have a lead already, or just process all of them.
        # Since upsert_lead_from_inbound_message is idempotent, we can process all conversations.
        result = await session.execute(select(Conversation))
        conversations = result.scalars().all()
        
        count = 0
        for conv in conversations:
            contact = await session.get(Contact, conv.contact_id)
            inbox = await session.get(Inbox, conv.inbox_id)
            
            if not contact or not inbox:
                continue
                
            logger.info(f"Processing conversation {conv.id} for contact {contact.name}...")
            await upsert_lead_from_inbound_message(
                session=session,
                inbox=inbox,
                contact=contact,
                conversation=conv,
                channel_type=conv.channel_type,
                capture_source="auto"
            )
            count += 1
            
        await session.commit()
        logger.info(f"Successfully backfilled leads for {count} conversations!")

if __name__ == "__main__":
    asyncio.run(backfill_leads())
