from pydantic import BaseModel


class DashboardSummary(BaseModel):
    customers: int
    leads: int
    opportunities: int
    products: int
    orders: int
    order_status_breakdown: dict[str, int]
    payment_status_breakdown: dict[str, int]
