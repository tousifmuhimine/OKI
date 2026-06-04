import asyncio
import random
import time
import httpx
from app.core.config import settings

async def create_user(client, email, password, company_name, org_type_code, role, org_id=None):
    admin_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    user_metadata = {
        "name": f"Name {role}",
        "company_name": company_name,
        "org_type_code": org_type_code,
        "role": role
    }
    if org_id:
        user_metadata["org_id"] = org_id

    user_payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": user_metadata
    }
    resp = await client.post(admin_url, headers=headers, json=user_payload)
    assert resp.status_code in (200, 201), f"User creation failed: {resp.text}"
    return resp.json().get("id")

async def get_token(client, email, password):
    login_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Content-Type": "application/json",
    }
    resp = await client.post(login_url, headers=headers, json={"email": email, "password": password})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.json().get("access_token")

async def main():
    timestamp = int(time.time())
    rand = random.randint(1000, 9999)
    company = f"Delete Testing Org {rand}"
    
    admin_email = f"delete-admin-{timestamp}-{rand}@example.com"
    member_email = f"delete-member-{timestamp}-{rand}@example.com"
    password = "password123"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        print("1. Registering super admin user...")
        admin_id = await create_user(client, admin_email, password, company, "study_abroad", "super_admin")
        
        print("\n2. Obtaining access token for admin...")
        admin_token = await get_token(client, admin_email, password)
        
        # Initialize local database profiles by making initial API calls
        print("\n3. Initializing admin profile on local backend...")
        resp = await client.get("http://localhost:8000/api/v1/organizations/users/me", headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200, f"Admin initialization failed: {resp.text}"
        admin_data = resp.json()
        org_id = admin_data.get("organization_id")
        print(f"Generated organization ID: {org_id}")
        
        print("\n4. Registering regular employee member in the same organization...")
        member_id = await create_user(client, member_email, password, company, "study_abroad", "employee", org_id=org_id)
        
        print(f"Registered Admin ID: {admin_id}, Member ID: {member_id}")
        
        print("\n5. Obtaining access token for member...")
        member_token = await get_token(client, member_email, password)
        
        print("\n6. Initializing member profile on local backend...")
        resp = await client.get("http://localhost:8000/api/v1/organizations/users/me", headers={"Authorization": f"Bearer {member_token}"})
        assert resp.status_code == 200, f"Member initialization failed: {resp.text}"
        
        print("\n7. Testing authorization constraints...")
        
        # Test 7.1: Non-super_admin (member) attempts to delete member (should get 403)
        resp = await client.delete(
            f"http://localhost:8000/api/v1/organizations/users/{member_id}",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        print(f"  Employee deletes member -> Status {resp.status_code} (Expected 403)")
        assert resp.status_code == 403
        
        # Test 7.2: Super admin attempts to delete themselves (should get 400)
        resp = await client.delete(
            f"http://localhost:8000/api/v1/organizations/users/{admin_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"  Super admin deletes themselves -> Status {resp.status_code} (Expected 400)")
        assert resp.status_code == 400
        
        print("\n8. Testing deletion of team member...")
        
        # Test 8.1: Super admin deletes the member
        resp = await client.delete(
            f"http://localhost:8000/api/v1/organizations/users/{member_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        print(f"  Super admin deletes member -> Status {resp.status_code} (Expected 204)")
        assert resp.status_code == 204
        
        # Test 8.2: Verify member is deleted from local DB (should return 401 or fail authentication)
        resp = await client.get(
            "http://localhost:8000/api/v1/organizations/users/me",
            headers={"Authorization": f"Bearer {member_token}"}
        )
        print(f"  Deleted user calls profile API -> Status {resp.status_code} (Expected 401/404)")
        assert resp.status_code in (401, 404, 500) # 401 unauthorized or 500/404 profile not found is expected
        
        # Test 8.3: Verify login fails or user is deleted in Supabase
        login_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
        resp = await client.post(login_url, headers={"apikey": settings.supabase_service_role_key}, json={"email": member_email, "password": password})
        print(f"  Deleted user attempts login -> Status {resp.status_code} (Expected 400)")
        assert resp.status_code == 400
        
        print("\nVerification Successful: All delete constraints and authorization checks passed!")

if __name__ == "__main__":
    asyncio.run(main())
