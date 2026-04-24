from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Customer
from app.schemas.customer import CustomerCreate, CustomerListResponse, CustomerOut, CustomerUpdate
from app.schemas.common import PaginationMeta


router = APIRouter()


@router.get("", response_model=CustomerListResponse)
async def list_customers(
    stage: str | None = None,
    country_region: str | None = None,
    search: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerListResponse:
    query = select(Customer)
    count_query = select(func.count(Customer.id))

    if stage:
        query = query.where(Customer.stage == stage)
        count_query = count_query.where(Customer.stage == stage)
    if country_region:
        query = query.where(Customer.country_region == country_region)
        count_query = count_query.where(Customer.country_region == country_region)
    if search:
        needle = f"%{search}%"
        condition = or_(
            Customer.company_name.ilike(needle),
            Customer.contact_person.ilike(needle),
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    query = query.order_by(Customer.updated_at.desc()).limit(limit).offset(offset)

    rows = (await session.execute(query)).scalars().all()
    total = (await session.execute(count_query)).scalar_one()

    return CustomerListResponse(
        data=[CustomerOut.model_validate(row) for row in rows],
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    entity = Customer(**payload.model_dump())
    if not entity.assigned_user_id:
        entity.assigned_user_id = auth.user_id

    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return CustomerOut.model_validate(entity)


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerOut.model_validate(entity)


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> CustomerOut:
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")

    for key, value in payload.model_dump(exclude_none=True).items():
        setattr(entity, key, value)

    await session.commit()
    await session.refresh(entity)
    return CustomerOut.model_validate(entity)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(
    customer_id: str,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> None:
    entity = await session.get(Customer, customer_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Customer not found")

    await session.delete(entity)
    await session.commit()
