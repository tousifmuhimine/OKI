import asyncio
import sys
from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Organization, OrganizationType, Pipeline, PipelineStage, LeadStage
from app.services.industry_seeder import seed_organization_defaults

async def main():
    if len(sys.argv) < 2:
        print("Usage: python change_org_type.py <org_type_code> [org_id]")
        print("Available codes: study_abroad, ecommerce, vendors_interior, real_estate")
        return

    target_code = sys.argv[1]
    org_id = sys.argv[2] if len(sys.argv) > 2 else "dev-org"

    async with SessionLocal() as session:
        # Get organization type
        stmt = select(OrganizationType).where(OrganizationType.code == target_code)
        org_type = (await session.execute(stmt)).scalar_one_or_none()
        if not org_type:
            print(f"Error: OrganizationType code '{target_code}' not found.")
            return

        # Get organization
        org = await session.get(Organization, org_id)
        if not org:
            print(f"Error: Organization '{org_id}' not found.")
            return

        print(f"Current Org '{org.company_name}' Type ID: {org.organization_type_id}")
        
        # Update type
        org.organization_type_id = org_type.id
        await session.flush()

        # Delete existing pipelines & stages so they can be reseeded
        from sqlalchemy import delete, update
        from app.db.models import Lead
        
        # Clear foreign keys on leads
        await session.execute(
            update(Lead).where(Lead.organization_id == org_id).values(lead_stage_id=None)
        )
        await session.flush()

        pipelines = (await session.execute(
            select(Pipeline).where(Pipeline.organization_id == org_id)
        )).scalars().all()
        for p in pipelines:
            await session.execute(delete(PipelineStage).where(PipelineStage.pipeline_id == p.id))
            await session.delete(p)

        await session.execute(delete(LeadStage).where(LeadStage.organization_id == org_id))
        await session.flush()

        # Seed new defaults
        await seed_organization_defaults(session, org_id, target_code)
        await session.commit()
        print(f"Successfully changed organization '{org_id}' type to '{target_code}' and reseeded pipeline!")

if __name__ == "__main__":
    asyncio.run(main())
