from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models import OrganizationType, Pipeline, PipelineStage, Department, LeadStage

INDUSTRY_DEFAULTS = {
    "real_estate": {
        "pipeline_name": "Real Estate Sales Pipeline",
        "stages": [
            {"name": "Inquiry", "probability": 10},
            {"name": "Site Visits Booked", "probability": 30},
            {"name": "Deed/Legal Review", "probability": 60},
            {"name": "Financing/Installments", "probability": 80},
            {"name": "Registration", "probability": 100, "is_closed": True},
            {"name": "Closed Lost", "probability": 0, "is_closed": True},
        ],
        "departments": []
    },
    "study_abroad": {
        "pipeline_name": "Study Abroad Application Pipeline",
        "stages": [
            {"name": "Discovery", "probability": 10},
            {"name": "Registration", "probability": 20},
            {"name": "Document Submitted", "probability": 30},
            {"name": "Document Approved", "probability": 40},
            {"name": "Offer Letter Applied", "probability": 55},
            {"name": "Offer Letter Received", "probability": 70},
            {"name": "Interview Scheduled", "probability": 75},
            {"name": "Interview Pass", "probability": 85},
            {"name": "Medical Done", "probability": 90},
            {"name": "Ticket & Fly", "probability": 100, "is_closed": True},
        ],
        "departments": [
            {"name": "Counselor Department", "code": "counselor"},
            {"name": "Admission Department", "code": "admission"},
        ]
    },
    "ecommerce": {
        "pipeline_name": "E-commerce Merchant Onboarding Pipeline",
        "stages": [
            {"name": "Lead Gen", "probability": 10},
            {"name": "Pitch", "probability": 30},
            {"name": "KYC Verification", "probability": 50},
            {"name": "SLA Negotiation", "probability": 70},
            {"name": "Cataloging", "probability": 90},
            {"name": "Live", "probability": 100, "is_closed": True},
            {"name": "Dropped", "probability": 0, "is_closed": True},
        ],
        "departments": []
    },
    "vendors_interior": {
        "pipeline_name": "Vendors & Interior Project Pipeline",
        "stages": [
            {"name": "Site Measurement", "probability": 20},
            {"name": "Layout/Concept Design", "probability": 40},
            {"name": "BOQ & Costing", "probability": 60},
            {"name": "Advance & Work Order", "probability": 80},
            {"name": "Handover", "probability": 100, "is_closed": True},
            {"name": "Closed Lost", "probability": 0, "is_closed": True},
        ],
        "departments": []
    }
}


async def seed_organization_types(session: AsyncSession) -> None:
    types = [
        {"name": "Real Estate", "code": "real_estate"},
        {"name": "Study Abroad", "code": "study_abroad"},
        {"name": "Ecommerce", "code": "ecommerce"},
        {"name": "Vendors / Interior Company", "code": "vendors_interior"}
    ]
    for t in types:
        exists = (await session.execute(
            select(OrganizationType).where(OrganizationType.code == t["code"])
        )).scalar_one_or_none()
        if not exists:
            session.add(OrganizationType(name=t["name"], code=t["code"]))
    await session.flush()


async def seed_organization_defaults(session: AsyncSession, org_id: str, industry_code: str) -> None:
    # Ensure types are seeded first
    await seed_organization_types(session)
    
    defaults = INDUSTRY_DEFAULTS.get(industry_code)
    if not defaults:
        return

    # Check if pipeline already exists
    existing_pipeline = (await session.execute(
        select(Pipeline).where(Pipeline.organization_id == org_id, Pipeline.name == defaults["pipeline_name"])
    )).scalar_one_or_none()

    if not existing_pipeline:
        pipeline = Pipeline(
            organization_id=org_id,
            name=defaults["pipeline_name"],
            is_active=True
        )
        session.add(pipeline)
        await session.flush()

        for idx, stage in enumerate(defaults["stages"]):
            session.add(PipelineStage(
                pipeline_id=pipeline.id,
                name=stage["name"],
                position=idx,
                is_closed=stage.get("is_closed", False),
                probability_percent=stage["probability"]
            ))

    # Seed LeadStages
    existing_stages = (await session.execute(
        select(LeadStage).where(LeadStage.organization_id == org_id)
    )).scalars().all()

    if not existing_stages:
        for idx, stage in enumerate(defaults["stages"]):
            session.add(LeadStage(
                organization_id=org_id,
                name=stage["name"],
                position=idx,
                is_closed=stage.get("is_closed", False),
                probability_percent=stage["probability"],
                is_active=True
            ))

    # Seed departments if any
    for dept in defaults["departments"]:
        exists = (await session.execute(
            select(Department).where(Department.organization_id == org_id, Department.code == dept["code"])
        )).scalar_one_or_none()
        if not exists:
            session.add(Department(
                organization_id=org_id,
                name=dept["name"],
                code=dept["code"]
            ))
            
    await session.flush()
