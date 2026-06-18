import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Lead, LeadShareLink, User

async def list_data():
    async with SessionLocal() as session:
        leads_res = await session.execute(select(Lead))
        leads = leads_res.scalars().all()
        print(f"Total Leads: {len(leads)}")
        for i, lead in enumerate(leads):
            print(f"Lead {i+1}: ID={lead.id}, Company={lead.company_name}, Contact={lead.contact_person}, OrgID={lead.organization_id}")

        users_res = await session.execute(select(User))
        users = users_res.scalars().all()
        print(f"\nTotal Users: {len(users)}")
        for i, user in enumerate(users):
            print(f"User {i+1}: ID={user.id}, Email={user.email}, RoleID={user.role_id}")

        from app.db.models import Role
        roles_res = await session.execute(select(Role))
        roles = roles_res.scalars().all()
        print(f"\nTotal Roles: {len(roles)}")
        for i, role in enumerate(roles):
            print(f"Role {i+1}: ID={role.id}, Code={role.code}, Name={role.name}")

        shares_res = await session.execute(select(LeadShareLink))
        shares = shares_res.scalars().all()
        print(f"\nTotal Share Links: {len(shares)}")
        for i, share in enumerate(shares):
            print(f"Share {i+1}: ID={share.id}, LeadID={share.lead_id}, LeadIDs={share.lead_ids}, Token={share.token}, IsPublic={share.is_public}, AllowedEmails={share.allowed_emails}")

if __name__ == "__main__":
    asyncio.run(list_data())
