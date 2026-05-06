from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Organization

router = APIRouter()

class OrganizationOut(BaseModel):
    id: str
    company_name: str

@router.get("/me", response_model=OrganizationOut)
async def get_my_organization(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> OrganizationOut:
    if not auth.org_id:
        raise HTTPException(status_code=403, detail="Organization not identified")

    org = await session.get(Organization, auth.org_id)
    if not org:
        # Create organization record on the fly if it doesn't exist but org_id is in token
        org = Organization(id=auth.org_id, company_name="My Organization")
        session.add(org)
        await session.commit()
        await session.refresh(org)

    return OrganizationOut(
        id=org.id,
        company_name=org.company_name
    )
