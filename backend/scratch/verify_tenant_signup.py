import asyncio
import random
import time
import httpx
from app.core.config import settings

async def main():
    email = f"test-realestate-{int(time.time())}-{random.randint(1000, 9999)}@example.com"
    password = "password123"
    company_name = f"Acme Real Estate {random.randint(100, 999)}"
    org_type_code = "real_estate"
    
    print(f"1. Creating user in Supabase: {email}")
    admin_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "Content-Type": "application/json",
    }
    
    user_payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "name": "Real Estate Admin",
            "company_name": company_name,
            "org_type_code": org_type_code,
            "role": "super_admin"
        }
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(admin_url, headers=headers, json=user_payload)
        if resp.status_code not in (200, 201):
            print(f"Failed to create user: {resp.text}")
            return
        
        user_data = resp.json()
        user_id = user_data.get("id")
        print(f"User created with ID: {user_id}")
        
        print("\n2. Logging in to get access token...")
        login_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/token?grant_type=password"
        # We need the client/anon key or service role key to authenticate
        login_headers = {
            "apikey": settings.supabase_service_role_key,
            "Content-Type": "application/json",
        }
        login_payload = {
            "email": email,
            "password": password
        }
        resp = await client.post(login_url, headers=login_headers, json=login_payload)
        if resp.status_code != 200:
            print(f"Failed to login: {resp.text}")
            return
        
        token_data = resp.json()
        access_token = token_data.get("access_token")
        print("Logged in successfully. Access token obtained.")
        
        print("\n3. Verifying with local backend...")
        backend_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
        
        # Test 1: GET /organizations/users/me
        resp = await client.get("http://localhost:8000/api/v1/organizations/users/me", headers=backend_headers)
        print(f"GET /organizations/users/me -> Status {resp.status_code}")
        if resp.status_code == 200:
            user_profile = resp.json()
            print(f"  User Profile: {user_profile}")
            org_id = user_profile.get("organization_id")
            print(f"  Assigned Organization ID: {org_id}")
            assert org_id != "dev-org", f"Error: User assigned to dev-org!"
        else:
            print(f"  Error: {resp.text}")
            return

        # Test 2: GET /organizations/me
        resp = await client.get("http://localhost:8000/api/v1/organizations/me", headers=backend_headers)
        print(f"GET /organizations/me -> Status {resp.status_code}")
        if resp.status_code == 200:
            org_profile = resp.json()
            print(f"  Organization Profile: {org_profile}")
            assert org_profile.get("company_name") == company_name, f"Expected company name {company_name}, got {org_profile.get('company_name')}"
            assert org_profile.get("organization_type_code") == org_type_code, f"Expected org type {org_type_code}, got {org_profile.get('organization_type_code')}"
        else:
            print(f"  Error: {resp.text}")
            return

        # Test 3: GET /leads (verify isolation - should not contain dev-org's leads)
        resp = await client.get("http://localhost:8000/api/v1/leads", headers=backend_headers)
        print(f"GET /api/v1/leads -> Status {resp.status_code}")
        if resp.status_code == 200:
            leads_json = resp.json()
            leads_list = leads_json.get("data", [])
            print(f"  Fetched {len(leads_list)} leads for new organization.")
            # Check lead leakage
            for lead in leads_list:
                assert lead.get("organization_id") == org_id, f"Leakage detected! Lead belongs to {lead.get('organization_id')}, expected {org_id}"
            print("  Verification Successful: No data leakage detected, isolation holds!")
        else:
            print(f"  Error: {resp.text}")

if __name__ == "__main__":
    asyncio.run(main())
