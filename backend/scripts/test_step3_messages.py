#!/usr/bin/env python3
"""Test script for Step 3: Verify message storage system works correctly."""

import os
import sys
import asyncio
from datetime import datetime
from uuid import uuid4

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.db.models import Inbox, Contact, Conversation, Message
from sqlalchemy import select


async def test_message_storage():
    """Test that conversations and messages can be created and retrieved."""
    async with SessionLocal() as session:
        print("🧪 STEP 3 Test: Message Storage System")
        print("=" * 60)
        
        workspace_id = str(uuid4())
        
        # Create test inbox
        inbox = Inbox(
            workspace_id=workspace_id,
            name="Test WhatsApp Inbox",
            channel_type="whatsapp",
            channel_config={"phone_number": "+1234567890"}
        )
        session.add(inbox)
        await session.commit()
        await session.refresh(inbox)
        print(f"✅ Created inbox: {inbox.id}")
        
        # Create test contact
        contact = Contact(
            workspace_id=workspace_id,
            name="Test Contact",
            email="contact@example.com",
            phone="+9876543210",
            channel_identifiers={"whatsapp": "1234567890"}
        )
        session.add(contact)
        await session.commit()
        await session.refresh(contact)
        print(f"✅ Created contact: {contact.id}")
        
        # Create test conversation
        conversation = Conversation(
            workspace_id=workspace_id,
            inbox_id=inbox.id,
            contact_id=contact.id,
            status="open",
            channel_type="whatsapp",
        )
        session.add(conversation)
        await session.commit()
        await session.refresh(conversation)
        print(f"✅ Created conversation: {conversation.id}")
        print(f"   Status: {conversation.status}")
        print(f"   Channel: {conversation.channel_type}")
        print()
        
        # Create test messages
        messages_to_create = [
            ("Hello, I'm interested in your product", "incoming", "contact"),
            ("Thanks for reaching out! What specific features interest you?", "outgoing", "agent"),
            ("I need to understand the pricing", "incoming", "contact"),
            ("Let me send you our pricing details", "outgoing", "agent"),
        ]
        
        created_messages = []
        for content, msg_type, sender in messages_to_create:
            msg = Message(
                conversation_id=conversation.id,
                content=content,
                message_type=msg_type,
                sender_type=sender,
                sender_id="system" if sender == "agent" else contact.id,
                metadata={"source": "whatsapp"}
            )
            session.add(msg)
            created_messages.append(msg)
        
        await session.commit()
        for msg in created_messages:
            await session.refresh(msg)
        
        print(f"✅ Created {len(created_messages)} messages")
        for i, msg in enumerate(created_messages, 1):
            print(f"   Message {i}: [{msg.message_type}] {msg.sender_type} - {msg.content[:40]}...")
        print()
        
        # Retrieve conversation history
        stmt = select(Message).where(Message.conversation_id == conversation.id).order_by(Message.created_at)
        result = await session.execute(stmt)
        retrieved_messages = result.scalars().all()
        
        print("🔍 Verification: Retrieved conversation history")
        print(f"   Found {len(retrieved_messages)} messages")
        for msg in retrieved_messages:
            print(f"   - [{msg.created_at.strftime('%H:%M:%S')}] {msg.sender_type}: {msg.content[:45]}...")
        print()
        
        # Verify counts
        assert len(retrieved_messages) == 4, "Should have 4 messages"
        assert all(m.conversation_id == conversation.id for m in retrieved_messages), "All messages belong to conversation"
        assert retrieved_messages[0].message_type == "incoming", "First message should be incoming"
        assert retrieved_messages[1].message_type == "outgoing", "Second message should be outgoing"
        
        print("✅ All message retrieval assertions passed!")
        print()
        
        # Update conversation status
        stmt = select(Conversation).where(Conversation.id == conversation.id)
        result = await session.execute(stmt)
        conv = result.scalar_one()
        conv.status = "resolved"
        await session.commit()
        await session.refresh(conv)
        
        print("✅ Updated conversation status to 'resolved'")
        print(f"   New status: {conv.status}")
        print()
        
        print("🎉 STEP 3 Test PASSED - Message storage system working correctly")
        print()
        
        # Cleanup
        stmt = select(Message).where(Message.conversation_id == conversation.id)
        result = await session.execute(stmt)
        msgs = result.scalars().all()
        for m in msgs:
            await session.delete(m)
        
        await session.delete(conversation)
        await session.delete(contact)
        await session.delete(inbox)
        await session.commit()
        print("🧹 Test data cleaned up")


if __name__ == "__main__":
    asyncio.run(test_message_storage())
