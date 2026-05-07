#!/usr/bin/env python3
"""Integration test for feature gap closure endpoints"""
import asyncio
import httpx
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"
HEADERS = {"Authorization": "Bearer test-token"}  # Replace with actual auth if needed

async def test_endpoints():
    """Test core feature endpoints"""
    async with httpx.AsyncClient() as client:
        print("=" * 60)
        print("INTEGRATION TEST: Feature Gap Endpoints")
        print("=" * 60)
        
        # Test 1: Get conversations list
        print("\n[1] Testing GET /inbox/conversations...")
        try:
            resp = await client.get(f"{BASE_URL}/inbox/conversations", headers=HEADERS, timeout=10)
            print(f"    Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"    Found {len(data.get('items', []))} conversations")
                if data.get('items'):
                    conv = data['items'][0]
                    conv_id = conv['id']
                    print(f"    First conversation ID: {conv_id}")
                    print(f"    is_bot_paused: {conv.get('is_bot_paused', 'NOT SET')}")
                    print(f"    assigned_user_id: {conv.get('assigned_user_id', 'NOT SET')}")
                    
                    # Test 2: Pause conversation
                    print("\n[2] Testing PATCH /inbox/conversations/{id}/pause...")
                    resp = await client.patch(
                        f"{BASE_URL}/inbox/conversations/{conv_id}/pause",
                        headers=HEADERS,
                        timeout=10
                    )
                    print(f"    Status: {resp.status_code}")
                    if resp.status_code in [200, 204]:
                        data = resp.json() if resp.status_code == 200 else {"message": "paused"}
                        print(f"    Response: {data}")
                    
                    # Test 3: Resume conversation
                    print("\n[3] Testing PATCH /inbox/conversations/{id}/resume...")
                    resp = await client.patch(
                        f"{BASE_URL}/inbox/conversations/{conv_id}/resume",
                        headers=HEADERS,
                        timeout=10
                    )
                    print(f"    Status: {resp.status_code}")
                    if resp.status_code in [200, 204]:
                        data = resp.json() if resp.status_code == 200 else {"message": "resumed"}
                        print(f"    Response: {data}")
                    
                    # Test 4: Takeover conversation
                    print("\n[4] Testing PATCH /inbox/conversations/{id}/takeover...")
                    resp = await client.patch(
                        f"{BASE_URL}/inbox/conversations/{conv_id}/takeover",
                        headers=HEADERS,
                        timeout=10
                    )
                    print(f"    Status: {resp.status_code}")
                    if resp.status_code in [200, 204]:
                        data = resp.json() if resp.status_code == 200 else {"message": "takeover successful"}
                        print(f"    Response: {data}")
                        
            elif resp.status_code == 401:
                print("    Status 401: Authentication required")
            elif resp.status_code == 404:
                print("    Status 404: Endpoint not found")
            else:
                print(f"    Error: {resp.text}")
                
        except httpx.ConnectError:
            print("    ❌ Cannot connect to server (is it running on localhost:8000?)")
        except Exception as e:
            print(f"    ❌ Error: {e}")
        
        # Test 5: Admin user creation
        print("\n[5] Testing POST /admin/users...")
        try:
            resp = await client.post(
                f"{BASE_URL}/admin/users",
                headers=HEADERS,
                json={
                    "email": "test-admin@example.com",
                    "password": "TempPassword123!"
                },
                timeout=10
            )
            print(f"    Status: {resp.status_code}")
            if resp.status_code in [200, 201]:
                data = resp.json()
                print(f"    Created user: {data.get('email')}")
                print(f"    User ID: {data.get('id')}")
            elif resp.status_code == 401:
                print("    Status 401: Admin authentication required")
            elif resp.status_code == 403:
                print("    Status 403: Missing permissions.manage permission")
            else:
                print(f"    Status: {resp.status_code} - {resp.text}")
        except Exception as e:
            print(f"    ❌ Error: {e}")
        
        print("\n" + "=" * 60)
        print("Test Complete")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(test_endpoints())
