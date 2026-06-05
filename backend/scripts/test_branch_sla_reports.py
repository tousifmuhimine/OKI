import asyncio
import os
import sys
from datetime import datetime, timezone, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.db.models import User, Role, Branch, Organization, Lead, Assignment, LeadActivity, CommunicationLog
from app.api.routes.admin import synergy_report, list_admin_users
from app.api.routes.organizations import list_org_users, update_org_user, delete_organization_user
from app.api.routes.leads_clean import create_lead, update_lead
from app.schemas.lead import LeadCreate, LeadUpdate
from app.api.routes.organizations import UserUpdatePayload
from app.api.deps import AuthContext
from fastapi import HTTPException
from sqlalchemy import select, delete

class DummyAuthContext(AuthContext):
    def __init__(self, user_id, role, branch_id, org_id):
        self.user_id = user_id
        self.role = role
        self.branch_id = branch_id
        self.org_id = org_id
        self.email = f"{user_id}@test.com"

async def test_branch_sla_reports():
    print("Initializing Synergy & SLA Scoped Verification Tests...")
    
    async with SessionLocal() as session:
        # Pre-cleanup in case a previous run crashed
        await session.execute(delete(Lead).where(Lead.phone == "+1234567890"))
        await session.execute(delete(User).where(User.id.in_(["super-admin-uuid", "b1-admin-uuid", "b1-emp-uuid", "b2-emp-uuid"])))
        await session.execute(delete(Branch).where(Branch.id.in_(["branch-1-uuid", "branch-2-uuid"])))
        await session.execute(delete(Organization).where(Organization.id == "test-org-uuid"))
        await session.commit()

        # Create test organization
        test_org = Organization(id="test-org-uuid", company_name="Test Synergy Org")
        session.add(test_org)
        await session.flush()
        
        # Create test branches
        branch1 = Branch(id="branch-1-uuid", organization_id=test_org.id, name="North Branch")
        branch2 = Branch(id="branch-2-uuid", organization_id=test_org.id, name="South Branch")
        session.add_all([branch1, branch2])
        await session.flush()
        
        # Get or create roles
        roles = {}
        for r_code in ("super_admin", "branch_admin", "individual_agent", "employee"):
            stmt = select(Role).where(Role.code == r_code)
            res = await session.execute(stmt)
            role_obj = res.scalar_one_or_none()
            if not role_obj:
                role_obj = Role(name=r_code.replace("_", " ").title(), code=r_code)
                session.add(role_obj)
                await session.flush()
            roles[r_code] = role_obj

        # Create users
        # 1. Super Admin
        super_admin = User(
            id="super-admin-uuid",
            organization_id=test_org.id,
            email="super@test.com",
            role_id=roles["super_admin"].id,
            name="Super Admin"
        )
        # 2. Branch 1 Admin
        b1_admin = User(
            id="b1-admin-uuid",
            organization_id=test_org.id,
            branch_id=branch1.id,
            email="b1admin@test.com",
            role_id=roles["branch_admin"].id,
            name="Branch 1 Admin"
        )
        # 3. Branch 1 Employee (Staff)
        b1_emp = User(
            id="b1-emp-uuid",
            organization_id=test_org.id,
            branch_id=branch1.id,
            email="b1emp@test.com",
            role_id=roles["employee"].id,
            name="Branch 1 Employee"
        )
        # 4. Branch 2 Employee (Staff)
        b2_emp = User(
            id="b2-emp-uuid",
            organization_id=test_org.id,
            branch_id=branch2.id,
            email="b2emp@test.com",
            role_id=roles["employee"].id,
            name="Branch 2 Employee"
        )
        session.add_all([super_admin, b1_admin, b1_emp, b2_emp])
        await session.commit()
        print("Test Setup: Org, Branches, and Scoped Users Created.")

        # Test contexts
        super_auth = DummyAuthContext(super_admin.id, "super_admin", None, test_org.id)
        b1_admin_auth = DummyAuthContext(b1_admin.id, "branch_admin", branch1.id, test_org.id)

        # ----------------------------------------------------
        # Test 1: User listing scoping for branch admin
        # ----------------------------------------------------
        print("\nTest 1: Verifying User Scoping for Branch Admin...")
        org_users = await list_org_users(auth=b1_admin_auth, session=session)
        org_user_ids = {u.id for u in org_users}
        
        # Branch 1 Admin should see: themselves and Branch 1 Employee
        # Should NOT see: Branch 2 Employee
        assert b1_admin.id in org_user_ids
        assert b1_emp.id in org_user_ids
        assert b2_emp.id not in org_user_ids
        print("SUCCESS: Branch Admin only listed users belonging to their branch.")

        # ----------------------------------------------------
        # Test 2: User management restrictions for branch admin
        # ----------------------------------------------------
        print("\nTest 2: Verifying User Update & Delete restrictions...")
        # Try to update branch 2 employee as branch 1 admin -> Should fail with 403
        try:
            payload = UserUpdatePayload(name="Intruder Update")
            await update_org_user(user_id=b2_emp.id, payload=payload, auth=b1_admin_auth, session=session)
            print("FAILED: Branch Admin edited user from another branch!")
            sys.exit(1)
        except HTTPException as e:
            assert e.status_code == 403
            print("SUCCESS: Branch Admin blocked from updating user from another branch.")

        # Try to delete branch 2 employee as branch 1 admin -> Should fail with 403
        try:
            await delete_organization_user(user_id=b2_emp.id, auth=b1_admin_auth, session=session)
            print("FAILED: Branch Admin deleted user from another branch!")
            sys.exit(1)
        except HTTPException as e:
            assert e.status_code == 403
            print("SUCCESS: Branch Admin blocked from deleting user from another branch.")

        # ----------------------------------------------------
        # Test 3: Lead SLAs auto-calculation
        # ----------------------------------------------------
        print("\nTest 3: Verifying Lead SLA Calculations on Assignment...")
        # Create a lead assigned to Branch 1 Employee
        lead_data = LeadCreate(
            company_name="SLA Test Corp",
            contact_person="Tester",
            phone="+1234567890",
            status="new",
            assigned_user_id=b1_emp.id,
            sla_duration_hours=5
        )
        
        # We need to make sure we clean up any pre-existing lead with this phone number first
        await session.execute(delete(Lead).where(Lead.phone == "+1234567890"))
        await session.commit()

        lead_out = await create_lead(payload=lead_data, auth=b1_admin_auth, session=session)
        assert lead_out.assigned_at is not None
        assert lead_out.target_stage_by is not None
        
        # Check deadline is roughly assigned_at + 5 hours
        diff = lead_out.target_stage_by - lead_out.assigned_at
        assert abs(diff.total_seconds() - 5 * 3600) < 10 # within 10 seconds tolerance
        print("SUCCESS: Lead creation set assigned_at and calculated target_stage_by.")

        # Update lead SLA duration
        update_data = LeadUpdate(sla_duration_hours=10)
        lead_updated = await update_lead(lead_id=lead_out.id, payload=update_data, auth=b1_admin_auth, session=session)
        assert lead_updated.target_stage_by is not None
        diff_updated = lead_updated.target_stage_by - lead_updated.assigned_at
        assert abs(diff_updated.total_seconds() - 10 * 3600) < 10
        print("SUCCESS: Lead update re-calculated target_stage_by SLA correctly.")

        # ----------------------------------------------------
        # Test 4: Synergy Report generation
        # ----------------------------------------------------
        print("\nTest 4: Verifying Synergy Report statistics and daily timeline...")
        # Call synergy report as Branch 1 Admin
        report_data = await synergy_report(auth=b1_admin_auth, session=session)
        
        # Total assigned in summary
        assert report_data.summary.total_assigned >= 1
        
        # Verify employee row
        emp_detail = next((e for e in report_data.employees if e.id == b1_emp.id), None)
        assert emp_detail is not None
        assert emp_detail.assigned_count == 1
        assert emp_detail.untouched_count == 0
        assert emp_detail.touched_count == 1
        
        # Verify daily_stats timeline exists (should have 7 days)
        assert len(emp_detail.daily_stats) == 7
        
        # The last element (today) should show the assignment we just made
        today_stat = emp_detail.daily_stats[-1]
        assert today_stat.assigned == 1
        print("SUCCESS: Synergy report compiled statistics and daily stats timeline correctly.")

        # ----------------------------------------------------
        # Cleanup
        # ----------------------------------------------------
        print("\nCleaning up test data...")
        await session.execute(delete(Lead).where(Lead.id == lead_out.id))
        await session.execute(delete(User).where(User.id.in_([super_admin.id, b1_admin.id, b1_emp.id, b2_emp.id])))
        await session.execute(delete(Branch).where(Branch.id.in_([branch1.id, branch2.id])))
        await session.execute(delete(Organization).where(Organization.id == test_org.id))
        await session.commit()
        print("Cleanup completed.")
        print("\nALL SCOPING & SLA VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_branch_sla_reports())
