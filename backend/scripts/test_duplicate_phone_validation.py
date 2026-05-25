import asyncio
import os
import sys
from decimal import Decimal

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.db.models import Lead
from app.api.routes.leads_clean import create_lead, update_lead
from app.schemas.lead import LeadCreate, LeadUpdate
from app.api.deps import AuthContext
from fastapi import HTTPException
from sqlalchemy import select

class DummyAuthContext(AuthContext):
    def __init__(self):
        self.user_id = "test-user-id"
        self.role = "admin"
        self.org_id = None
        self.permissions = set()

async def test_duplicate_validation():
    print("Testing duplicate phone number validation...")
    auth = DummyAuthContext()
    
    async with SessionLocal() as session:
        # Create first lead
        lead1_data = LeadCreate(
            company_name="Duplicate Test Corp 1",
            contact_person="Alice",
            phone="+999999999",
            status="new"
        )
        
        # We need to test the validation by calling create_lead API directly
        # First check if there is an existing lead with this phone in database and clean it up
        stmt = select(Lead).where(Lead.phone == "+999999999")
        res = await session.execute(stmt)
        for lead in res.scalars().all():
            await session.delete(lead)
        await session.commit()

        # Let's create lead 1
        lead1 = await create_lead(payload=lead1_data, auth=auth, session=session)
        print(f"Created lead 1: {lead1.company_name} (ID: {lead1.id})")

        # Try to create lead 2 with same phone number
        lead2_data = LeadCreate(
            company_name="Duplicate Test Corp 2",
            contact_person="Bob",
            phone="+999999999",
            status="new"
        )

        try:
            await create_lead(payload=lead2_data, auth=auth, session=session)
            print("FAILED: Registered duplicate lead phone number without error!")
            success = False
        except HTTPException as e:
            print(f"SUCCESS: Caught expected HTTP exception: {e.status_code} - {e.detail}")
            assert e.status_code == 400
            assert "already exists: Duplicate Test Corp 1" in e.detail
            success = True

        # Now test update_lead validation
        # Create lead 3 with a different phone number
        lead3_data = LeadCreate(
            company_name="Duplicate Test Corp 3",
            contact_person="Charlie",
            phone="+888888888",
            status="new"
        )
        lead3 = await create_lead(payload=lead3_data, auth=auth, session=session)
        print(f"Created lead 3: {lead3.company_name} (ID: {lead3.id})")

        # Try to update lead 3's phone number to lead 1's phone number (+999999999)
        update_data = LeadUpdate(phone="+999999999")
        try:
            await update_lead(lead_id=lead3.id, payload=update_data, auth=auth, session=session)
            print("FAILED: Updated to duplicate phone number without error!")
            success = False
        except HTTPException as e:
            print(f"SUCCESS: Caught expected HTTP exception during update: {e.status_code} - {e.detail}")
            assert e.status_code == 400
            assert "already exists: Duplicate Test Corp 1" in e.detail
            success = success and True

        # Cleanup
        db_lead1 = await session.get(Lead, lead1.id)
        if db_lead1:
            await session.delete(db_lead1)
        db_lead3 = await session.get(Lead, lead3.id)
        if db_lead3:
            await session.delete(db_lead3)
        await session.commit()
        print("Cleanup completed.")
        
        if success:
            print("ALL DUP PHONENUMBER TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_duplicate_validation())
