#!/usr/bin/env python3
"""Test script for Step 2: Verify lead dynamic fields work correctly."""

import os
import sys
import json
import asyncio
from datetime import datetime
from decimal import Decimal

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.db.models import Lead
from sqlalchemy import select


async def test_lead_fields():
    """Test that new lead fields persist to database."""
    async with SessionLocal() as session:
        print("🧪 STEP 2 Test: Dynamic Lead Fields")
        print("=" * 60)
        
        # Create a test lead with new fields
        test_lead = Lead(
            company_name="Test E-com Company",
            contact_person="John Doe",
            email="john@example.com",
            phone="+1234567890",
            status="new",
            industry="ecommerce",
            source="manual",
            # New Step 2 fields
            intent="Looking for inventory management solution",
            engagement="high",
            trust_level="medium",
            budget_min=Decimal("5000.00"),
            budget_max=Decimal("25000.00"),
            last_summary="Customer interested in scaling operations",
            assigned_agent_id="agent-uuid-12345",
        )
        
        session.add(test_lead)
        await session.commit()
        await session.refresh(test_lead)
        
        print(f"✅ Created lead: {test_lead.id}")
        print(f"   Company: {test_lead.company_name}")
        print(f"   Intent: {test_lead.intent}")
        print(f"   Engagement: {test_lead.engagement}")
        print(f"   Trust Level: {test_lead.trust_level}")
        print(f"   Budget Range: ${test_lead.budget_min} - ${test_lead.budget_max}")
        print(f"   Last Summary: {test_lead.last_summary}")
        print(f"   Assigned Agent: {test_lead.assigned_agent_id}")
        print()
        
        # Retrieve and verify
        stmt = select(Lead).where(Lead.id == test_lead.id)
        result = await session.execute(stmt)
        retrieved = result.scalar_one()
        
        print("🔍 Verification: Retrieved from database")
        print(f"   Intent: {retrieved.intent}")
        print(f"   Engagement: {retrieved.engagement}")
        print(f"   Trust Level: {retrieved.trust_level}")
        print(f"   Budget Range: ${retrieved.budget_min} - ${retrieved.budget_max}")
        print(f"   Last Summary: {retrieved.last_summary}")
        print(f"   Assigned Agent: {retrieved.assigned_agent_id}")
        print()
        
        # Verify all fields match
        assert retrieved.intent == "Looking for inventory management solution"
        assert retrieved.engagement == "high"
        assert retrieved.trust_level == "medium"
        assert retrieved.budget_min == Decimal("5000.00")
        assert retrieved.budget_max == Decimal("25000.00")
        assert retrieved.last_summary == "Customer interested in scaling operations"
        assert retrieved.assigned_agent_id == "agent-uuid-12345"
        
        print("✅ All field values match!")
        print()
        print("🎉 STEP 2 Test PASSED - All dynamic fields working correctly")
        
        # Cleanup
        await session.delete(retrieved)
        await session.commit()
        print("🧹 Test lead cleaned up")


if __name__ == "__main__":
    asyncio.run(test_lead_fields())
