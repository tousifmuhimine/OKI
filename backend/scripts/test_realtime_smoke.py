#!/usr/bin/env python3
"""Smoke test for the realtime websocket hub."""

import asyncio
import os
import sys
from dataclasses import dataclass, field

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8") if hasattr(sys.stdout, "reconfigure") else None
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.inbox.ws_hub import broadcast, register, unregister


@dataclass
class FakeWebSocket:
    sent: list[dict] = field(default_factory=list)

    async def send_json(self, message: dict) -> None:
        self.sent.append(message)


async def main() -> None:
    print("[TEST] realtime hub smoke test")
    websocket_a = FakeWebSocket()
    websocket_b = FakeWebSocket()
    conversation_id = "conv-smoke-001"

    await register(conversation_id, websocket_a)  # type: ignore[arg-type]
    await register(conversation_id, websocket_b)  # type: ignore[arg-type]

    payload = {"conversation_id": conversation_id, "event": "message.created", "text": "hello realtime"}
    sent_count = await broadcast(conversation_id, payload)

    assert sent_count == 2, f"expected 2 sockets, got {sent_count}"
    assert websocket_a.sent == [payload], websocket_a.sent
    assert websocket_b.sent == [payload], websocket_b.sent

    await unregister(conversation_id, websocket_a)  # type: ignore[arg-type]
    await unregister(conversation_id, websocket_b)  # type: ignore[arg-type]

    sent_after = await broadcast(conversation_id, payload)
    assert sent_after == 0, f"expected 0 sockets after unregister, got {sent_after}"

    print("[OK] realtime hub broadcast/registration flow works")


if __name__ == "__main__":
    asyncio.run(main())
