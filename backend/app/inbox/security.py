import base64
import hashlib
import json
from typing import Any

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _get_cipher() -> Fernet:
    secret = (
        settings.channel_config_secret
        or settings.supabase_jwt_secret
        or settings.supabase_service_role_key
    )
    if not secret:
        raise RuntimeError("CHANNEL_CONFIG_SECRET or Supabase secret is required")

    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_channel_config(config: dict[str, Any]) -> dict[str, Any]:
    raw = json.dumps(config, separators=(",", ":"), sort_keys=True).encode("utf-8")
    token = _get_cipher().encrypt(raw).decode("utf-8")
    return {"encrypted": True, "value": token}


def decrypt_channel_config(config: dict[str, Any]) -> dict[str, Any]:
    if not config.get("encrypted"):
        return config

    try:
        raw = _get_cipher().decrypt(str(config["value"]).encode("utf-8"))
    except (InvalidToken, KeyError) as exc:
        raise RuntimeError("Unable to decrypt channel config") from exc

    return json.loads(raw.decode("utf-8"))


def summarize_channel_config(config: dict[str, Any]) -> dict[str, Any]:
    if config.get("encrypted"):
        return {"encrypted": True}
    return {key: "***" for key in config}
