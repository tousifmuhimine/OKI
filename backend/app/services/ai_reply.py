"""AI reply generation service for conversations."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import GroqProvider, DEFAULT_GROQ_MODEL
from app.inbox.security import decrypt_channel_config

logger = logging.getLogger(__name__)


# Company type specific system prompts
SYSTEM_PROMPTS = {
    "ecommerce": """You are a helpful customer service assistant for an e-commerce business.
Your role is to:
- Answer product questions professionally
- Help customers with orders and shipping
- Suggest relevant products when appropriate
- Keep responses concise and friendly

Respond naturally and helpfully. Do NOT mention that you're an AI.""",
    
    "real_estate": """You are a helpful real estate agent assistant.
Your role is to:
- Answer questions about properties
- Help schedule viewings
- Provide information about neighborhoods
- Answer questions about financing and prices
- Keep responses professional and informative

Respond naturally and helpfully. Do NOT mention that you're an AI.""",
    
    "study_abroad": """You are a helpful study abroad consultant.
Your role is to:
- Answer questions about universities and programs
- Help with application guidance
- Provide information about costs and scholarships
- Answer questions about visa and requirements
- Keep responses informative and encouraging

Respond naturally and helpfully. Do NOT mention that you're an AI.""",
}

DEFAULT_SYSTEM_PROMPT = """You are a helpful customer service assistant.
Respond naturally and professionally. Do NOT mention that you're an AI."""


async def generate_ai_reply(
    session: AsyncSession,
    *,
    message: str,
    company_type: Optional[str] = None,
    workspace_id: str,
    user_id: str,
) -> str:
    """Generate AI reply to a message.
    
    Args:
        session: Database session
        message: The message to reply to
        company_type: Type of company (ecommerce, real_estate, study_abroad, etc.)
        workspace_id: Workspace ID
        user_id: User ID (to load their AI config)
    
    Returns:
        Generated reply text
        
    Raises:
        ValueError: If no AI provider is configured or generation fails
    """
    # Load user's AI config
    stmt = select(UserLLMConfig).where(
        UserLLMConfig.workspace_id == workspace_id,
        UserLLMConfig.user_id == user_id,
    )
    result = await session.execute(stmt)
    config = result.scalar_one_or_none()
    
    if not config:
        raise ValueError(f"No AI provider configured for user {user_id}. Please configure AI settings.")
    
    if config.provider.lower() != "groq":
        raise ValueError(f"AI provider '{config.provider}' not yet supported. Please use Groq.")
    
    # Decrypt the API key
    try:
        decrypted_config = decrypt_channel_config(config.encrypted_config)
        api_key = decrypted_config.get("api_key")
        if not api_key:
            raise ValueError("API key not found in decrypted config")
    except Exception as e:
        logger.error(f"Failed to decrypt AI config: {e}")
        raise ValueError("Failed to decrypt AI configuration")
    
    # Get the model to use
    model = config.model_preferences.get("default") or config.default_model or DEFAULT_GROQ_MODEL
    
    # Get the system prompt based on company type
    system_prompt = SYSTEM_PROMPTS.get(company_type) if company_type else DEFAULT_SYSTEM_PROMPT
    
    # Build the full prompt
    full_prompt = f"{system_prompt}\n\nCustomer message: {message}\n\nRespond helpfully:"
    
    # Generate reply using Groq
    try:
        provider = GroqProvider(api_key)
        reply = await provider.generate(
            model=model,
            prompt=full_prompt,
            max_tokens=256,
        )
        logger.info(f"[AI Reply] Generated for user={user_id}, company_type={company_type}")
        return reply.strip()
    except Exception as e:
        logger.error(f"Failed to generate AI reply: {e}")
        raise ValueError(f"Failed to generate reply: {str(e)}")
