import asyncio
import sys
import os
import httpx

# Add parent directory to sys.path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Organization, Lead
from app.main import app

async def run_tests():
    # 1. Ensure we have dev-org and dev-user set up
    async with SessionLocal() as session:
        org = await session.get(Organization, "dev-org")
        if not org:
            print("ERROR: dev-org organization must exist in database to run tests!")
            return
        
        # Reset org to standard free state before starting
        org.plan_name = "free"
        org.subscription_status = "active"
        org.subscription_cycle = "monthly"
        org.chatbot_enabled = True
        org.crm_enabled = True
        org.lead_bulk_share_enabled = True
        org.requested_plan_name = None
        org.requested_subscription_cycle = None
        org.requested_at = None
        
        # Grant leads view/manage permissions to dev-org user
        from app.db.models import PermissionGrant
        for key in ["leads.view", "leads.manage"]:
            res = await session.execute(
                select(PermissionGrant).where(
                    PermissionGrant.workspace_id == "dev-org",
                    PermissionGrant.user_id == "dev-org",
                    PermissionGrant.permission_key == key
                )
            )
            grant = res.scalar_one_or_none()
            if not grant:
                session.add(
                    PermissionGrant(
                        workspace_id="dev-org",
                        user_id="dev-org",
                        permission_key=key,
                        is_allowed=True
                    )
                )
        await session.commit()
        print("dev-org organization and user permissions reset to initial state.")

    # We use in-process AsyncClient to test our routes directly
    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        
        # Test headers:
        # Regular tenant flow has X-Dev-Workspace-Id = dev-org (defaults to super_admin in anon dev mode,
        # but let's test roles. Since we want to test super admin vs regular user,
        # let's mock it using headers or direct calls if needed. Wait, in deps.py:
        # if settings.allow_anon_dev and settings.debug:
        #   user_id = dev_workspace_id or "dev-user"
        #   org_id = dev_workspace_id or "dev-org"
        #   role_code is loaded from database based on user_id.
        # Let's check:
        # - User 'dev-user' is super_admin in 'dev-org'.
        # - User 'dev-org' is branch_admin in 'dev-org'.
        # So:
        # - Pass Header "X-Dev-Workspace-Id": "dev-user" or no header to run as super_admin.
        # - Pass Header "X-Dev-Workspace-Id": "dev-org" to run as branch_admin (regular user).
        
        headers_admin = {} # defaults to user_id=dev-user, org_id=dev-org, role=super_admin
        headers_user = {"X-Dev-Workspace-Id": "dev-org"} # defaults to user_id=dev-org, org_id=dev-org, role=branch_admin
        
        # Test case 1: Fetch current billing
        print("\n--- Test Case 1: Fetch current billing ---")
        res = await client.get("/api/v1/organizations/me/billing", headers=headers_user)
        assert res.status_code == 200
        billing_data = res.json()
        print(f"Current Plan: {billing_data['plan_name']}, chatbot_enabled: {billing_data['chatbot_enabled']}")
        assert billing_data["plan_name"] == "free"
        assert billing_data["requested_plan_name"] is None

        # Test case 2: Request upgrade to Premium (Yearly)
        print("\n--- Test Case 2: Request upgrade to Premium (Yearly) ---")
        payload = {
            "plan_name": "premium",
            "subscription_cycle": "yearly"
        }
        res = await client.post("/api/v1/organizations/me/billing/request-plan", json=payload, headers=headers_user)
        assert res.status_code == 200
        billing_data = res.json()
        print(f"Request status: plan={billing_data['requested_plan_name']}, cycle={billing_data['requested_subscription_cycle']}")
        assert billing_data["requested_plan_name"] == "premium"
        assert billing_data["requested_subscription_cycle"] == "yearly"

        # Test case 3: List all organizations (Regular user should be rejected, Super Admin should be allowed)
        print("\n--- Test Case 3: List all organizations (Permissions) ---")
        res_fail = await client.get("/api/v1/organizations/all", headers=headers_user)
        assert res_fail.status_code == 403
        print(f"Regular user list all (Expected 403): {res_fail.status_code}")

        res_ok = await client.get("/api/v1/organizations/all", headers=headers_admin)
        assert res_ok.status_code == 200
        all_orgs = res_ok.json()
        print(f"Super Admin list all (Expected 200): found {len(all_orgs)} organizations.")
        dev_org_in_list = [o for o in all_orgs if o["id"] == "dev-org"][0]
        assert dev_org_in_list["requested_plan_name"] == "premium"

        # Test case 4: Reject request (test both reject and approve paths)
        print("\n--- Test Case 4: Reject request first ---")
        res_rej = await client.post("/api/v1/organizations/dev-org/billing/reject", headers=headers_admin)
        assert res_rej.status_code == 200
        billing_data = res_rej.json()
        print(f"After reject: plan={billing_data['plan_name']}, requested={billing_data['requested_plan_name']}")
        assert billing_data["plan_name"] == "free"
        assert billing_data["requested_plan_name"] is None

        # Re-submit request
        await client.post("/api/v1/organizations/me/billing/request-plan", json=payload, headers=headers_user)

        # Test case 5: Approve request as admin
        print("\n--- Test Case 5: Approve request ---")
        res_app = await client.post("/api/v1/organizations/dev-org/billing/approve", headers=headers_admin)
        assert res_app.status_code == 200
        billing_data = res_app.json()
        print(f"After approve: plan={billing_data['plan_name']}, cycle={billing_data['subscription_cycle']}, chatbot_enabled={billing_data['chatbot_enabled']}")
        assert billing_data["plan_name"] == "premium"
        assert billing_data["subscription_cycle"] == "yearly"
        assert billing_data["chatbot_enabled"] is True
        assert billing_data["lead_bulk_share_enabled"] is True
        assert billing_data["requested_plan_name"] is None

        # Test case 6: Disable CRM feature manually via admin patch
        print("\n--- Test Case 6: Disable CRM feature and verify block ---")
        patch_payload = {
            "crm_enabled": False
        }
        res_patch = await client.patch("/api/v1/organizations/dev-org/billing", json=patch_payload, headers=headers_admin)
        assert res_patch.status_code == 200
        assert res_patch.json()["crm_enabled"] is False

        # Try to access a CRM route (GET /api/v1/leads) as tenant user
        res_crm_blocked = await client.get("/api/v1/leads", headers=headers_user)
        print(f"Access leads with CRM disabled (Expected 403): {res_crm_blocked.status_code}, Body: {res_crm_blocked.json()}")
        assert res_crm_blocked.status_code == 403
        assert "CRM access is disabled" in res_crm_blocked.json()["detail"]

        # Restore CRM access
        patch_payload = {
            "crm_enabled": True
        }
        await client.patch("/api/v1/organizations/dev-org/billing", json=patch_payload, headers=headers_admin)
        
        # Verify access is restored
        res_crm_ok = await client.get("/api/v1/leads", headers=headers_user)
        print(f"Access leads with CRM restored (Expected 200): {res_crm_ok.status_code}")
        assert res_crm_ok.status_code == 200

        # Test case 7: Disable Bulk Sharing and verify block
        print("\n--- Test Case 7: Disable Bulk Sharing and verify block ---")
        patch_payload = {
            "lead_bulk_share_enabled": False
        }
        await client.patch("/api/v1/organizations/dev-org/billing", json=patch_payload, headers=headers_admin)
        
        # Get some lead ID to request bulk share
        leads_res = await client.get("/api/v1/leads", headers=headers_user)
        leads = leads_res.json()["data"]
        lead_ids = [l["id"] for l in leads[:2]]
        
        # Try to bulk share
        share_payload = {
            "lead_ids": lead_ids,
            "mode": "public"
        }
        res_share_blocked = await client.post("/api/v1/leads/bulk-share-links", json=share_payload, headers=headers_user)
        print(f"Bulk share with feature disabled (Expected 403): {res_share_blocked.status_code}, Body: {res_share_blocked.json()}")
        assert res_share_blocked.status_code == 403
        assert "Bulk lead sharing is disabled" in res_share_blocked.json()["detail"]

        # Restore Bulk Share
        patch_payload = {
            "lead_bulk_share_enabled": True
        }
        await client.patch("/api/v1/organizations/dev-org/billing", json=patch_payload, headers=headers_admin)

        res_share_ok = await client.post("/api/v1/leads/bulk-share-links", json=share_payload, headers=headers_user)
        print(f"Bulk share with feature restored (Expected 201): {res_share_ok.status_code}")
        assert res_share_ok.status_code == 201

    print("\nALL BACKEND SUBSCRIPTION & BILLING INTEGRATION TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
