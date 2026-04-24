from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import Customer, Lead, Opportunity, Product, SalesOrder
from app.schemas.dashboard import DashboardSummary


router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    _: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> DashboardSummary:
    customers = (await session.execute(select(func.count(Customer.id)))).scalar_one()
    leads = (await session.execute(select(func.count(Lead.id)))).scalar_one()
    opportunities = (await session.execute(select(func.count(Opportunity.id)))).scalar_one()
    products = (await session.execute(select(func.count(Product.id)))).scalar_one()
    orders = (await session.execute(select(func.count(SalesOrder.id)))).scalar_one()

    order_rows = (
        await session.execute(
            select(SalesOrder.status, func.count(SalesOrder.id)).group_by(SalesOrder.status)
        )
    ).all()
    payment_rows = (
        await session.execute(
            select(SalesOrder.payment_status, func.count(SalesOrder.id)).group_by(SalesOrder.payment_status)
        )
    ).all()

    return DashboardSummary(
        customers=customers,
        leads=leads,
        opportunities=opportunities,
        products=products,
        orders=orders,
        order_status_breakdown={row[0]: row[1] for row in order_rows},
        payment_status_breakdown={row[0]: row[1] for row in payment_rows},
    )
