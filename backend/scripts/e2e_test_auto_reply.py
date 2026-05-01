"""
End-to-end test for WhatsApp auto-reply.
Run: python scripts/e2e_test_auto_reply.py
Make sure your uvicorn server is running at localhost:8000.
Replace PHONE_NUMBER_ID with a real inbox phone_number_id from your DB.
"""
import asyncio
import httpx
import time

BASE_URL = "http://localhost:8000"
PHONE_NUMBER_ID = "1106903459173882"   # <-- real phone_number_id from whatsapp inbox
WA_ID = "15551234567"

PAYLOAD = {
    "entry": [{
        "changes": [{
            "value": {
                "metadata": {"phone_number_id": PHONE_NUMBER_ID},
                "messages": [{
                    "id": f"wamid.test.{int(time.time())}",
                    "from": WA_ID,
                    "timestamp": str(int(time.time())),
                    "text": {"body": "Hello, this is a test message for auto-reply."}
                }],
                "contacts": [{
                    "wa_id": WA_ID,
                    "profile": {"name": "E2E Test User"}
                }]
            }
        }]
    }]
}

async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        print("--- Sending test webhook ---")
        r = await client.post(
            f"{BASE_URL}/api/v1/inbox/webhooks/whatsapp",
            json=PAYLOAD,
        )
        print(f"Status: {r.status_code}")
        print(f"Body:   {r.text}")

    print("\n--- Check your uvicorn logs for [auto-reply] lines ---")
    print("--- Also check DB: SELECT content, message_type FROM messages ORDER BY created_at DESC LIMIT 5; ---")

asyncio.run(main())
