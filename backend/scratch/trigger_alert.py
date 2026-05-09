import asyncio
import sys
from datetime import datetime, timezone

# Add backend to path so we can import app modules
sys.path.append(".")

from app.db.session import SessionLocal
from app.services.intelligence import create_alert_notification
from app.inbox.ws_hub import broadcast_notification

async def trigger_fake_alert():
    workspace_id = "dev-user"
    
    # 1. Save to DB
    async with SessionLocal() as session:
        notification = await create_alert_notification(
            session=session,
            workspace_id=workspace_id,
            title="Negotiation Detected",
            message="Customer is asking for a discount on the enterprise plan.",
            severity="high",
            payload={"source": "whatsapp", "signal": "negotiation"}
        )
        await session.commit()
        await session.refresh(notification)
        
        print(f"Created notification ID: {notification.id}")
        
        # 2. Push via WebSocket
        notification_dict = {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "severity": notification.severity,
            "read_at": None,
            "delivered_at": notification.delivered_at.isoformat(),
            "conversation_id": notification.conversation_id,
            "lead_id": notification.lead_id,
            "payload": notification.payload,
        }
        
        await broadcast_notification(workspace_id, notification_dict)
        print("WebSocket broadcast triggered!")

if __name__ == "__main__":
    asyncio.run(trigger_fake_alert())
