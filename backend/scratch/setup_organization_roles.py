import asyncio
from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.db.models import User, Role, Organization

async def main():
    engine = create_async_engine(settings.supabase_db_url)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        print("1. Seed/ensure roles 'super_admin' and 'branch_admin' exist...")
        roles_to_ensure = ["super_admin", "branch_admin", "individual_agent", "employee"]
        for r_code in roles_to_ensure:
            res = await session.execute(select(Role).where(Role.code == r_code))
            role_obj = res.scalar_one_or_none()
            if not role_obj:
                role_obj = Role(name=r_code.replace("_", " ").title(), code=r_code)
                session.add(role_obj)
        await session.flush()
        
        # Get role objects
        super_admin_role = (await session.execute(select(Role).where(Role.code == "super_admin"))).scalar_one()
        branch_admin_role = (await session.execute(select(Role).where(Role.code == "branch_admin"))).scalar_one()
        
        # Check if legacy 'admin' role exists
        res = await session.execute(select(Role).where(Role.code == "admin"))
        legacy_admin_role = res.scalar_one_or_none()
        
        print("\n2. Find target super admin user: abdullahtsn13@gmail.com")
        res = await session.execute(select(User).where(User.email == "abdullahtsn13@gmail.com"))
        target_user = res.scalar_one_or_none()
        if not target_user:
            print("Target user abdullahtsn13@gmail.com not found in local DB!")
        else:
            print(f"Target user found: {target_user.email} (Org: {target_user.organization_id}, Current Role ID: {target_user.role_id})")
            # Update target user to super admin
            target_user.role_id = super_admin_role.id
            target_user.organization_id = "dev-org" # ensure they are in dev-org
            print(f"Updated {target_user.email} to super_admin role.")
            
        print("\n3. Shift all other super_admins or admins in dev-org to branch_admin...")
        # Get users in dev-org
        res = await session.execute(select(User).where(User.organization_id == "dev-org"))
        dev_org_users = res.scalars().all()
        for u in dev_org_users:
            if u.email == "abdullahtsn13@gmail.com":
                continue
            
            # Check their role
            role_res = await session.execute(select(Role.code).where(Role.id == u.role_id))
            r_code = role_res.scalar_one_or_none()
            if r_code in ("super_admin", "admin"):
                u.role_id = branch_admin_role.id
                print(f"Shifted user {u.email} from {r_code} to branch_admin.")
                
        print("\n4. Clean up any remaining users of 'admin' role in other orgs...")
        if legacy_admin_role:
            res = await session.execute(select(User).where(User.role_id == legacy_admin_role.id))
            other_admins = res.scalars().all()
            for u in other_admins:
                if u.email == "abdullahtsn13@gmail.com":
                    u.role_id = super_admin_role.id
                    print(f"Set {u.email} to super_admin.")
                else:
                    u.role_id = branch_admin_role.id
                    print(f"Set {u.email} to branch_admin.")
                    
            await session.flush()
            
            print("\n5. Deleting legacy 'admin' role...")
            await session.execute(delete(Role).where(Role.code == "admin"))
            print("Role 'admin' deleted from DB.")
        else:
            print("Legacy 'admin' role was not present or already deleted.")
            
        # Ensure dev-org has a name
        org = await session.get(Organization, "dev-org")
        if org:
            if org.company_name == "My Organization" or not org.company_name:
                org.company_name = "Study Abroad Workspace"
                print("Renamed dev-org to 'Study Abroad Workspace'.")
        
        await session.commit()
        print("\nDatabase migration completed successfully!")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
