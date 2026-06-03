import asyncio
import os
import sys

# Add parent directory to path so we can import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.db.models import Organization, Pipeline, LeadStage
from sqlalchemy import update, delete

async def main():
    print("Connecting to the database and resetting organization configuration...")
    async with SessionLocal() as session:
        # Reset all organizations to have null type
        await session.execute(update(Organization).values(organization_type_id=None))
        await session.commit()
        print("Success! Reset all organizations to NULL type.")
        print("Now log back in or refresh the dashboard to see the onboarding page.")

if __name__ == "__main__":
    asyncio.run(main())
