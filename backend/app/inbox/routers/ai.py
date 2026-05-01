from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthContext, get_current_auth, get_session_dep
from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import SUPPORTED_GROQ_MODELS
from app.inbox.security import encrypt_channel_config, summarize_channel_config
from app.schemas.llm import UserLLMConfigCreate, UserLLMConfigRead


router = APIRouter()


def _validate_groq_models(payload: UserLLMConfigCreate) -> None:
    if payload.provider != "groq":
        return

    allowed = set(SUPPORTED_GROQ_MODELS)
    invalid_models: list[str] = []

    if payload.default_model and payload.default_model not in allowed:
        invalid_models.append(payload.default_model)

    for model in (payload.model_preferences or {}).values():
        if model and model not in allowed and model not in invalid_models:
            invalid_models.append(model)

    if invalid_models:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported Groq model(s): "
                + ", ".join(sorted(invalid_models))
                + ". Use one of: "
                + ", ".join(SUPPORTED_GROQ_MODELS)
            ),
        )


@router.get("/config", response_model=list[UserLLMConfigRead])
async def list_configs(
    auth: AuthContext = Depends(get_current_auth), session: AsyncSession = Depends(get_session_dep)
):
    q = select(UserLLMConfig).where(UserLLMConfig.user_id == auth.user_id)
    res = await session.execute(q)
    rows = res.scalars().all()

    # mask encrypted config when returning
    results = []
    for r in rows:
        results.append(UserLLMConfigRead(
            id=r.id,
            provider=r.provider,
            default_model=r.default_model,
            model_preferences=r.model_preferences or {},
            automation_modes=r.automation_modes or {},
        ))

    return results


@router.post("/config", response_model=UserLLMConfigRead)
async def upsert_config(
    payload: UserLLMConfigCreate,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    _validate_groq_models(payload)

    # encrypt api key and optional api_url using channel config cipher
    cfg: dict[str, str] = {"api_key": payload.api_key}
    if getattr(payload, "api_url", None):
        cfg["api_url"] = payload.api_url
    enc = encrypt_channel_config(cfg)

    # try update existing record for same provider & user
    q = select(UserLLMConfig).where(
        UserLLMConfig.user_id == auth.user_id, UserLLMConfig.provider == payload.provider
    )
    res = await session.execute(q)
    existing = res.scalar_one_or_none()

    if existing:
        stmt = (
            update(UserLLMConfig)
            .where(UserLLMConfig.id == existing.id)
            .values(
                encrypted_config=enc,
                default_model=payload.default_model,
                model_preferences=payload.model_preferences or {},
                automation_modes=payload.automation_modes or {},
            )
        )
        await session.execute(stmt)
        await session.commit()
        existing.encrypted_config = enc
        existing.default_model = payload.default_model
        existing.model_preferences = payload.model_preferences or {}
        existing.automation_modes = payload.automation_modes or {}
        r = existing
    else:
        r = UserLLMConfig(
            workspace_id=auth.user_id,
            user_id=auth.user_id,
            provider=payload.provider,
            encrypted_config=enc,
            default_model=payload.default_model,
            model_preferences=payload.model_preferences or {},
            automation_modes=payload.automation_modes or {},
        )
        session.add(r)
        await session.commit()
        await session.refresh(r)

    return UserLLMConfigRead(
        id=r.id,
        provider=r.provider,
        default_model=r.default_model,
        model_preferences=r.model_preferences or {},
        automation_modes=r.automation_modes or {},
    )


@router.delete("/config/{config_id}")
async def delete_config(
    config_id: str,
    auth: AuthContext = Depends(get_current_auth),
    session: AsyncSession = Depends(get_session_dep),
):
    q = select(UserLLMConfig).where(
        UserLLMConfig.id == config_id,
        UserLLMConfig.user_id == auth.user_id,
    )
    res = await session.execute(q)
    existing = res.scalar_one_or_none()
    if not existing:
        raise HTTPException(status_code=404, detail="Config not found")

    await session.delete(existing)
    await session.commit()
    return {"deleted": True, "id": config_id}
