import asyncio
from sqlalchemy import text
from app.db.session import SessionLocal

async def run():
    async with SessionLocal() as s:
        # Check leads table first for workspace_id
        r = await s.execute(text('SELECT DISTINCT workspace_id FROM leads LIMIT 5'))
        leads = [row[0] for row in r.all()]
        print("Leads workspaces:", leads)

        # Check organizations table for org_id
        r2 = await s.execute(text('SELECT DISTINCT workspace_id FROM organizations LIMIT 5'))
        orgs = [row[0] for row in r2.all()]
        print("Orgs workspaces:", orgs)

asyncio.run(run())
