import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings

async def main():
    engine = create_async_engine(settings.supabase_db_url)
    async with engine.connect() as conn:
        print("=== Organizations ===")
        orgs_res = await conn.execute(text("""
            SELECT o.id, o.company_name, t.code, t.name 
            FROM organizations o
            LEFT JOIN organization_types t ON o.organization_type_id = t.id
        """))
        for row in orgs_res.fetchall():
            print(f"Org ID: {row[0]} | Company: {row[1]} | Type Code: {row[2]} | Type Name: {row[3]}")

        print("\n=== Users ===")
        users_res = await conn.execute(text("""
            SELECT u.email, u.name, u.organization_id, r.code
            FROM users u
            LEFT JOIN roles r ON u.role_id = r.id
        """))
        for row in users_res.fetchall():
            print(f"User Email: {row[0]} | Name: {row[1]} | Org ID: {row[2]} | Role: {row[3]}")

        print("\n=== Leads Count by Org ===")
        leads_res = await conn.execute(text("""
            SELECT organization_id, COUNT(*) 
            FROM leads 
            GROUP BY organization_id
        """))
        for row in leads_res.fetchall():
            print(f"Org ID: {row[0]} | Lead Count: {row[1]}")

        print("\n=== Leads with NULL Organization ID ===")
        null_leads = await conn.execute(text("""
            SELECT COUNT(*) FROM leads WHERE organization_id IS NULL
        """))
        print(f"NULL org leads: {null_leads.scalar()}")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
