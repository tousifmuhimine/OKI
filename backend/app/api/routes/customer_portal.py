import os
import uuid
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from jose import jwt
from passlib.context import CryptContext

from app.api.deps import get_session_dep
from app.core.config import settings
from app.db.models import Customer, Lead, LeadActivity, Message, Document, User
from app.schemas.customer import CustomerOut
from app.schemas.document import DocumentOut
from app.schemas.lead import LeadTimelineItem

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/customer-portal/login", auto_error=False)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class CustomerLoginPayload(BaseModel):
    email: str
    password: str

class CustomerLoginResponse(BaseModel):
    token: str
    customer: CustomerOut

class CustomerProfileUpdate(BaseModel):
    company_name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    address: str | None = None
    country_region: str | None = None
    password: str | None = None

class AssignedAgentOut(BaseModel):
    name: str | None
    email: str
    role: str | None


def create_customer_token(customer_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    payload = {
        "sub": customer_id,
        "exp": expire,
        "role": "customer"
    }
    return jwt.encode(payload, settings.supabase_jwt_secret or "customer-secret", algorithm="HS256")


async def get_current_customer(
    token: str | None = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_session_dep),
) -> Customer:
    if not token:
        raise HTTPException(status_code=401, detail="Missing customer auth token")
    try:
        payload = jwt.decode(token, settings.supabase_jwt_secret or "customer-secret", algorithms=["HS256"])
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Access denied")
    customer_id = payload.get("sub")
    customer = await session.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=401, detail="Customer profile not found")
    return customer


@router.post("/login", response_model=CustomerLoginResponse)
async def customer_login(
    payload: CustomerLoginPayload,
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerLoginResponse:
    # Query customer by email
    res = await session.execute(select(Customer).where(Customer.email == payload.email.strip().lower()))
    customer = res.scalars().first()
    if not customer:
        raise HTTPException(status_code=400, detail="Invalid email or password")
    
    if not customer.password_hash:
        # For new customers who haven't set password yet, allow setting default password as phone number
        if customer.phone and payload.password == customer.phone.strip():
            customer.password_hash = pwd_context.hash(payload.password)
            await session.commit()
            await session.refresh(customer)
        else:
            raise HTTPException(status_code=400, detail="Portal password not set yet. Contact counselor.")

    if not pwd_context.verify(payload.password, customer.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    token = create_customer_token(customer.id)
    return CustomerLoginResponse(token=token, customer=CustomerOut.model_validate(customer))


@router.get("/me", response_model=CustomerOut)
async def get_my_profile(customer: Customer = Depends(get_current_customer)) -> CustomerOut:
    return CustomerOut.model_validate(customer)


@router.patch("/me", response_model=CustomerOut)
async def update_my_profile(
    payload: CustomerProfileUpdate,
    customer: Customer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    changes = payload.model_dump(exclude_unset=True)
    password = changes.pop("password", None)
    if password:
        customer.password_hash = pwd_context.hash(password)
    
    for key, value in changes.items():
        setattr(customer, key, value)
        
    await session.commit()
    await session.refresh(customer)
    return CustomerOut.model_validate(customer)


@router.get("/agent", response_model=AssignedAgentOut)
async def get_my_agent(
    customer: Customer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session_dep),
) -> AssignedAgentOut:
    if not customer.assigned_user_id:
        raise HTTPException(status_code=404, detail="No counselor assigned yet")
    
    user = await session.get(User, customer.assigned_user_id)
    if not user:
        # Fallback to dev user name
        return AssignedAgentOut(name="Primary Counselor", email="counseling@oki.crm", role="Counselor")
        
    from app.db.models import Role
    role = (await session.execute(select(Role.name).where(Role.id == user.role_id))).scalar_one_or_none()

    return AssignedAgentOut(
        name=user.name or "Primary Counselor",
        email=user.email,
        role=role or "Agent"
    )


@router.get("/timeline", response_model=list[LeadTimelineItem])
async def get_my_timeline(
    customer: Customer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session_dep),
) -> list[LeadTimelineItem]:
    # Find lead associated with customer
    res = await session.execute(select(Lead).where(Lead.converted_customer_id == customer.id))
    lead = res.scalars().first()
    if not lead:
        return []

    items = [
        LeadTimelineItem(
            id=activity.id,
            item_type="activity",
            activity_type=activity.activity_type,
            direction=activity.direction,
            platform=activity.platform,
            title=activity.title,
            content=activity.content,
            created_by_user_id=activity.created_by_user_id,
            due_at=activity.due_at,
            completed_at=activity.completed_at,
            created_at=activity.created_at,
        )
        for activity in (
            await session.execute(select(LeadActivity).where(LeadActivity.lead_id == lead.id))
        ).scalars().all()
    ]

    if lead.conversation_id:
        messages = (
            await session.execute(
                select(Message)
                .where(Message.conversation_id == lead.conversation_id)
                .order_by(Message.created_at.desc())
            )
        ).scalars().all()
        items.extend(
            LeadTimelineItem(
                id=message.id,
                item_type="message",
                activity_type="message",
                direction=message.message_type,
                platform=lead.capture_source or "conversation",
                title="Conversation message",
                content=message.content,
                created_by_user_id=message.sender_id,
                created_at=message.created_at,
            )
            for message in messages
        )

    return sorted(items, key=lambda item: item.created_at, reverse=True)


@router.get("/documents", response_model=list[DocumentOut])
async def list_my_documents(
    customer: Customer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session_dep),
) -> list[DocumentOut]:
    res = await session.execute(select(Document).where(Document.customer_id == customer.id))
    return list(res.scalars().all())


@router.post("/documents/upload", response_model=DocumentOut)
async def upload_my_document(
    file_type: str = Form(...),
    file: UploadFile = File(...),
    customer: Customer = Depends(get_current_customer),
    session: AsyncSession = Depends(get_session_dep),
) -> DocumentOut:
    os.makedirs("storage/documents", exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join("storage/documents", filename)
    
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())

    file_url = f"/storage/documents/{filename}"

    # Also try to resolve the original lead to attach it
    lead_res = await session.execute(select(Lead.id).where(Lead.converted_customer_id == customer.id))
    lead_id = lead_res.scalars().first()

    doc = Document(
        organization_id=customer.organization_id,
        lead_id=lead_id,
        customer_id=customer.id,
        name=file.filename,
        file_type=file_type,
        file_url=file_url,
        uploaded_by_id=None  # Uploaded by customer themselves
    )
    session.add(doc)
    await session.commit()
    await session.refresh(doc)
    return doc
