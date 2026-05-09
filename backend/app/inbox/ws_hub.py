from typing import Any, Dict
from fastapi import WebSocket
import asyncio
import logging

logger = logging.getLogger(__name__)

# conversation_id -> websocket id -> websocket instance
_connections: Dict[str, Dict[int, WebSocket]] = {}

# workspace_id -> websocket id -> websocket instance (for notification push)
_notification_connections: Dict[str, Dict[int, WebSocket]] = {}

_lock = asyncio.Lock()


async def register(conversation_id: str, ws: WebSocket) -> None:
    async with _lock:
        if conversation_id not in _connections:
            _connections[conversation_id] = {}
        _connections[conversation_id][id(ws)] = ws
        logger.info("ws_hub: registered connection for %s (count=%d)", conversation_id, len(_connections[conversation_id]))


async def unregister(conversation_id: str, ws: WebSocket) -> None:
    async with _lock:
        conns = _connections.get(conversation_id)
        if not conns:
            return
        conns.pop(id(ws), None)
        if not conns:
            _connections.pop(conversation_id, None)
        logger.info("ws_hub: unregistered connection for %s (remaining=%d)", conversation_id, len(_connections.get(conversation_id, {})))


async def broadcast(conversation_id: str, message: dict) -> int:
    """Broadcast a message dict (will be JSON-serialized by caller) to all sockets for conversation_id.
    Returns number of sockets messaged.
    """
    async with _lock:
        conns = list(_connections.get(conversation_id, {}).values())
    sent = 0
    for ws in conns:
        try:
            await ws.send_json(message)
            sent += 1
        except Exception:
            logger.exception("ws_hub: failed to send to socket for %s", conversation_id)
    logger.debug("ws_hub: broadcasted to %d sockets for %s", sent, conversation_id)
    return sent


# ---------------------------------------------------------------------------
# Notification channel — workspace-level push alerts
# ---------------------------------------------------------------------------

async def register_notification_socket(workspace_id: str, ws: WebSocket) -> None:
    """Register a WebSocket for workspace-level notification push."""
    async with _lock:
        if workspace_id not in _notification_connections:
            _notification_connections[workspace_id] = {}
        _notification_connections[workspace_id][id(ws)] = ws
        logger.info("ws_hub: registered notification socket for workspace=%s (count=%d)", workspace_id, len(_notification_connections[workspace_id]))


async def unregister_notification_socket(workspace_id: str, ws: WebSocket) -> None:
    """Unregister a notification WebSocket."""
    async with _lock:
        conns = _notification_connections.get(workspace_id)
        if not conns:
            return
        conns.pop(id(ws), None)
        if not conns:
            _notification_connections.pop(workspace_id, None)
        logger.info("ws_hub: unregistered notification socket for workspace=%s", workspace_id)


async def broadcast_notification(workspace_id: str, notification: dict[str, Any]) -> int:
    """Push a notification payload to all connected agents in a workspace.
    Returns number of sockets messaged.
    """
    async with _lock:
        conns = list(_notification_connections.get(workspace_id, {}).values())
    sent = 0
    payload = {"event": "notification.created", "data": notification}
    for ws in conns:
        try:
            await ws.send_json(payload)
            sent += 1
        except Exception:
            logger.exception("ws_hub: failed to send notification to workspace=%s", workspace_id)
    logger.debug("ws_hub: broadcast notification to %d sockets for workspace=%s", sent, workspace_id)
    return sent
