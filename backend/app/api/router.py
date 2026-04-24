from fastapi import APIRouter

from app.api.routes import customers, dashboard, health, leads, orders


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
