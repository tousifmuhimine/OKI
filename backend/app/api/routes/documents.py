import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep, apply_tenant_filters
from app.db.models import Document, Lead, Customer
from app.schemas.document import DocumentOut

router = APIRouter()

@router.post("/upload", response_model=DocumentOut)
async def upload_document(
    file_type: str = Form(...),
    lead_id: str | None = Form(None),
    customer_id: str | None = Form(None),
    file: UploadFile = File(...),
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> DocumentOut:
    if not lead_id and not customer_id:
        raise HTTPException(status_code=400, detail="Either lead_id or customer_id is required")

    # Verify authorization/tenancy for lead or customer
    if lead_id:
        lead = await session.get(Lead, lead_id)
        if not lead or lead.organization_id != auth.org_id:
            raise HTTPException(status_code=404, detail="Lead not found")
    if customer_id:
        cust = await session.get(Customer, customer_id)
        if not cust or cust.organization_id != auth.org_id:
            raise HTTPException(status_code=404, detail="Customer not found")

    # Save file to storage/documents
    os.makedirs("storage/documents", exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join("storage/documents", filename)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    # Build public URL
    file_url = f"/storage/documents/{filename}"

    doc = Document(
        organization_id=auth.org_id,
        lead_id=lead_id,
        customer_id=customer_id,
        name=file.filename,
        file_type=file_type,
        file_url=file_url,
        uploaded_by_id=auth.user_id
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return doc

@router.get("", response_model=list[DocumentOut])
async def list_documents(
    lead_id: str | None = None,
    customer_id: str | None = None,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> list[DocumentOut]:
    if not lead_id and not customer_id:
        raise HTTPException(status_code=400, detail="Either lead_id or customer_id is required")

    query = select(Document)
    if lead_id:
        query = query.where(Document.lead_id == lead_id)
    if customer_id:
        query = query.where(Document.customer_id == customer_id)

    query = apply_tenant_filters(query, auth, Document)
    rows = (await session.execute(query)).scalars().all()
    return rows

@router.delete("/{document_id}", status_code=204)
async def delete_document(
    document_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    doc = await session.get(Document, document_id)
    if not doc or doc.organization_id != auth.org_id:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete local file if it exists
    filepath = doc.file_url.lstrip("/")
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception:
            pass

    await session.delete(doc)
    await session.commit()
