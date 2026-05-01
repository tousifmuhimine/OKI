from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import SUPPORTED_GROQ_MODELS


router = APIRouter()


@router.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/chatbot")
async def chatbot_health_check(
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
) -> dict[str, object]:
    q = select(UserLLMConfig).where(UserLLMConfig.user_id == auth.user_id)
    res = await session.execute(q)
    configs = res.scalars().all()

    messenger_configs = [cfg for cfg in configs if (cfg.automation_modes or {}).get("messenger") == "chatbot"]
    ready_config = None
    for cfg in messenger_configs:
        if cfg.default_model and (cfg.provider != "groq" or cfg.default_model in SUPPORTED_GROQ_MODELS):
            ready_config = cfg
            break

    return {
        "status": "ok" if ready_config else "not_ready",
        "workspace_id": auth.user_id,
        "config_count": len(configs),
        "chatbot_enabled": bool(messenger_configs),
        "model_configured": bool(ready_config and ready_config.default_model),
        "provider": ready_config.provider if ready_config else None,
        "model": ready_config.default_model if ready_config else None,
        "model_valid": bool(
            ready_config and (ready_config.provider != "groq" or ready_config.default_model in SUPPORTED_GROQ_MODELS)
        ),
    }
