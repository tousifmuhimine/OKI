from fastapi import APIRouter

from app.api.routes import admin, alerts, analytics, customers, dashboard, health, orders, opportunities, tasks, permissions
from app.api.routes import leads_clean as leads
from app.inbox.routers import channels, integrations
from app.inbox.routers import ai, conversations


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["opportunities"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(conversations.router, prefix="/inbox", tags=["inbox"])
api_router.include_router(channels.router, prefix="/inbox", tags=["inbox-channels"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
