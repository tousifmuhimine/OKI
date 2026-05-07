#!/usr/bin/env python3
"""Test script for Step 6: Verify intent detection works correctly."""

import os
import sys
import asyncio
from uuid import uuid4

# Set UTF-8 encoding
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8') if hasattr(sys.stdout, 'reconfigure') else None

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.db.session import SessionLocal
from app.db.models import UserLLMConfig, Lead
from app.inbox.security import encrypt_channel_config
from app.services.entity_extraction import detect_intent_from_message, update_lead_intent, GroqProvider
from sqlalchemy import delete


async def test_intent_detection():
    async with SessionLocal() as session:
        print("[TEST] STEP 6 Test: Intent Detection")
        print("=" * 60)

        workspace_id = str(uuid4())
        user_id = str(uuid4())

        encrypted_cfg = encrypt_channel_config({"api_key": "test-key-placeholder"})
        config = UserLLMConfig(
            workspace_id=workspace_id,
            user_id=user_id,
            provider="groq",
            encrypted_config=encrypted_cfg,
            default_model="llama-3.1-8b-instant",
            model_preferences={},
            automation_modes={},
        )
        session.add(config)
        await session.commit()
        await session.refresh(config)
        print("[OK] Created user AI config")

        lead = Lead(
            company_name="Intent Test Lead",
            source="chat",
            status="new",
            assigned_user_id=workspace_id,
        )
        session.add(lead)
        await session.commit()
        await session.refresh(lead)
        print(f"[OK] Created test lead: {lead.id}")
        print()

        original_generate = GroqProvider.generate

        async def fake_generate(self, model: str, prompt: str, max_tokens: int = 512) -> str:
            lower_prompt = prompt.lower()
            if "i'm just browsing your options" in lower_prompt:
                return '{"intent":"browsing"}'
            if "can you compare the pricing between plans?" in lower_prompt:
                return '{"intent":"comparing"}'
            if "what's the best price and can i book a demo?" in lower_prompt:
                return '{"intent":"serious"}'
            return '{"intent":"browsing"}'

        GroqProvider.generate = fake_generate

        test_cases = [
            ("I'm just browsing your options", "browsing"),
            ("Can you compare the pricing between plans?", "comparing"),
            ("What's the best price and can I book a demo?", "serious"),
        ]

        try:
            for index, (message, expected_intent) in enumerate(test_cases, 1):
                print(f"Test {index}: {message}")
                result = await detect_intent_from_message(
                    session,
                    message=message,
                    workspace_id=workspace_id,
                    user_id=user_id,
                )
                print(f"   [OK] Intent: {result.intent}")
                assert result.intent == expected_intent, f"Expected {expected_intent}, got {result.intent}"
                print()

            print("Test: Updating lead intent")
            updated_lead = await update_lead_intent(session, lead.id, "serious")
            await session.commit()
            await session.refresh(updated_lead)
            print(f"   [OK] Lead intent updated to: {updated_lead.intent}")
            assert updated_lead.intent == "serious"
            print()

            print("=" * 60)
            print("[DONE] STEP 6 Test COMPLETED")
            print()
            print("Key features verified:")
            print("  [OK] Intent classification from message")
            print("  [OK] browsing / comparing / serious labels")
            print("  [OK] Lead intent persistence")
            print("  [OK] Per-user AI config loading")
            print()
        finally:
            GroqProvider.generate = original_generate
            await session.execute(delete(Lead).where(Lead.id == lead.id))
            await session.execute(delete(UserLLMConfig).where(UserLLMConfig.id == config.id))
            await session.commit()
            print("[CLEANUP] Test data cleaned up")


if __name__ == "__main__":
    asyncio.run(test_intent_detection())
