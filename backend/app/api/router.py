from fastapi import APIRouter, Depends

from app.api.deps import verify_crm_enabled
from app.api.routes import admin, alerts, analytics, customers, dashboard, health, lead_config, orders, opportunities, tasks, permissions, public, organizations, documents, customer_portal
from app.api.routes import leads_clean as leads
from app.inbox.routers import channels, integrations
from app.inbox.routers import ai, conversations


api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(lead_config.router, prefix="/config", tags=["lead-config"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(opportunities.router, prefix="/opportunities", tags=["opportunities"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(tasks.router, prefix="/tasks", tags=["tasks"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(alerts.router, prefix="/alerts", tags=["alerts"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(organizations.router, prefix="/organizations", tags=["organizations"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(customer_portal.router, prefix="/customer-portal", tags=["customer-portal"])
api_router.include_router(conversations.router, prefix="/inbox", tags=["inbox"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(channels.router, prefix="/inbox", tags=["inbox-channels"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"], dependencies=[Depends(verify_crm_enabled)])
api_router.include_router(public.router, prefix="/public", tags=["public"])

