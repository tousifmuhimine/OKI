from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Customer, SalesOrder
from app.schemas.common import PaginationMeta
from app.schemas.order import OrderCreate, OrderListResponse, OrderOut


router = APIRouter()


@router.get("", response_model=OrderListResponse)
async def list_orders(
    status_filter: str | None = Query(default=None, alias="status"),
    payment_status: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> OrderListResponse:
    # JOIN with customers to get company_name in one query
    query = (
        select(SalesOrder, Customer.company_name)
        .outerjoin(Customer, SalesOrder.customer_id == Customer.id)
    )
    count_query = select(func.count(SalesOrder.id))

    if status_filter:
        query = query.where(SalesOrder.status == status_filter)
        count_query = count_query.where(SalesOrder.status == status_filter)
    if payment_status:
        query = query.where(SalesOrder.payment_status == payment_status)
        count_query = count_query.where(SalesOrder.payment_status == payment_status)

    query = query.order_by(SalesOrder.updated_at.desc()).limit(limit).offset(offset)

    result_rows = (await session.execute(query)).all()
    total = (await session.execute(count_query)).scalar_one()

    order_outs = []
    for order, company_name in result_rows:
        out = OrderOut.model_validate(order)
        out.customer_name = company_name
        order_outs.append(out)

    return OrderListResponse(
        data=order_outs,
        meta=PaginationMeta(total=total, limit=limit, offset=offset),
    )


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> OrderOut:
    entity = SalesOrder(**payload.model_dump())
    session.add(entity)
    await session.commit()
    await session.refresh(entity)
    return OrderOut.model_validate(entity)
