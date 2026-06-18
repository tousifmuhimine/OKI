import asyncio
import sys
import os
import httpx

# Add parent directory to sys.path so we can import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import Lead
from app.main import app

async def run_tests():
    # 1. Fetch some test leads belonging to dev-org
    async with SessionLocal() as session:
        leads_res = await session.execute(
            select(Lead).where(Lead.organization_id == "dev-org").limit(2)
        )
        leads = leads_res.scalars().all()
        if len(leads) < 2:
            print("ERROR: Need at least 2 leads in dev-org database to test bulk sharing!")
            return
        
        lead_ids = [l.id for l in leads]
        print(f"Using test leads: {lead_ids}")

    headers = {}

    async with httpx.AsyncClient(app=app, base_url="http://test") as client:
        # Test case 1: Create a public bulk share link
        print("\n--- Test Case 1: Create public bulk share link ---")
        payload = {
            "lead_ids": lead_ids,
            "mode": "public",
            "expires_in_days": 1
        }
        res = await client.post("/api/v1/leads/bulk-share-links", json=payload, headers=headers)
        if res.status_code != 201:
            print(f"FAILED: Create public bulk share link. Status: {res.status_code}, Body: {res.text}")
            return
        
        share_data = res.json()
        print(f"SUCCESS: Created public share link: {share_data}")
        token = share_data["token"]
        
        # Test case 2: Access the public share link anonymously
        print("\n--- Test Case 2: Access public link anonymously ---")
        res_pub = await client.get(f"/api/v1/public/leads/{token}")
        if res_pub.status_code != 200:
            print(f"FAILED: Access public link anonymously. Status: {res_pub.status_code}, Body: {res_pub.text}")
            return
        
        pub_data = res_pub.json()
        print(f"SUCCESS: Resolved public leads: {[l['company_name'] for l in pub_data['leads']]}")
        assert len(pub_data["leads"]) == 2
        assert pub_data["is_public"] is True

        # Test case 3: Create a restricted bulk share link
        print("\n--- Test Case 3: Create restricted bulk share link ---")
        payload_restricted = {
            "lead_ids": lead_ids,
            "mode": "restricted",
            "allowed_emails": ["partner@example.com", "partner2@example.com"],
            "expires_in_days": 1
        }
        
        res_r = await client.post("/api/v1/leads/bulk-share-links", json=payload_restricted, headers=headers)
        if res_r.status_code != 201:
            print(f"FAILED: Create restricted bulk share link. Status: {res_r.status_code}, Body: {res_r.text}")
            return
        
        share_data_r = res_r.json()
        print(f"SUCCESS: Created restricted share link: {share_data_r}")
        token_r = share_data_r["token"]

        # Test case 4: Access restricted share link without email
        print("\n--- Test Case 4: Access restricted link without email ---")
        res_r_anon = await client.get(f"/api/v1/public/leads/{token_r}")
        print(f"Status (Expected 401): {res_r_anon.status_code}, Body: {res_r_anon.json()}")
        assert res_r_anon.status_code == 401

        # Test case 5: Access restricted share link with invalid email
        print("\n--- Test Case 5: Access restricted link with invalid email ---")
        res_r_invalid = await client.get(f"/api/v1/public/leads/{token_r}?email=wrong@example.com")
        print(f"Status (Expected 403): {res_r_invalid.status_code}, Body: {res_r_invalid.json()}")
        assert res_r_invalid.status_code == 403

        # Test case 6: Access restricted share link with valid email
        print("\n--- Test Case 6: Access restricted link with valid email ---")
        res_r_valid = await client.get(f"/api/v1/public/leads/{token_r}?email=PARTNER@example.com")
        if res_r_valid.status_code != 200:
            print(f"FAILED: Access restricted link with valid email. Status: {res_r_valid.status_code}, Body: {res_r_valid.text}")
            return
            
        pub_data_r = res_r_valid.json()
        print(f"SUCCESS: Resolved restricted leads: {[l['company_name'] for l in pub_data_r['leads']]}")
        assert len(pub_data_r["leads"]) == 2
        assert pub_data_r["is_public"] is False

    print("\nALL BACKEND API TESTS COMPLETED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
