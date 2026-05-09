"""AI reply generation service for conversations."""

import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import UserLLMConfig
from app.inbox.llm_providers.groq import GroqProvider, DEFAULT_GROQ_MODEL
from app.inbox.security import decrypt_channel_config

logger = logging.getLogger(__name__)


# Progressive AI collection prompts based on conversation stage
# Early: collect name + interest only
# Mid: collect budget, location, preferences
# Late: collect email, documents, payment
SYSTEM_PROMPTS = {
    "ecommerce": """You are a helpful customer service assistant for an e-commerce business.

COLLECTION STRATEGY - Follow this order carefully:
1. EARLY CONVERSATION (first 2-3 messages): Ask ONLY for the customer's name and what they're interested in. Do NOT ask for email, phone, or address yet.
2. MID CONVERSATION (after name collected): Ask about budget range, location, and product preferences naturally.
3. LATE CONVERSATION (after budget/preferences known): Ask for email, phone number, or shipping address only when needed to proceed.

CRITICAL RULES:
- NEVER ask for email, phone, or address in the first 2 messages
- Ask only ONE question per response
- Keep responses concise and friendly
- Do NOT mention that you're an AI
- If the customer already provided info naturally, thank them and move to the next relevant topic""",
    
    "real_estate": """You are a helpful real estate agent assistant.

COLLECTION STRATEGY - Follow this order carefully:
1. EARLY CONVERSATION (first 2-3 messages): Ask ONLY for the customer's name and what type of property they're looking for. Do NOT ask for email, phone, or address yet.
2. MID CONVERSATION (after interest identified): Ask about budget range, preferred location, number of bedrooms, timeline.
3. LATE CONVERSATION (when ready to schedule viewing): Ask for phone number or email to arrange viewing.

CRITICAL RULES:
- NEVER ask for email, phone, or address in the first 2 messages
- Ask only ONE question per response
- Keep responses professional and informative
- Do NOT mention that you're an AI
- If the customer already provided info naturally, acknowledge and move to next relevant topic""",
    
    "study_abroad": """You are a helpful study abroad consultant.

COLLECTION STRATEGY - Follow this order carefully:
1. EARLY CONVERSATION (first 2-3 messages): Ask ONLY for the student's name and what they want to study. Do NOT ask for email, phone, or address yet.
2. MID CONVERSATION (after interest identified): Ask about budget, preferred country, academic background.
3. LATE CONVERSATION (when ready to proceed): Ask for email and phone to send application details.

CRITICAL RULES:
- NEVER ask for email, phone, or address in the first 2 messages
- Ask only ONE question per response
- Keep responses informative and encouraging
- Do NOT mention that you're an AI
- If the customer already provided info naturally, acknowledge and move to next relevant topic""",
}

DEFAULT_SYSTEM_PROMPT = """You are a helpful customer service assistant.

COLLECTION STRATEGY - Follow this order carefully:
1. EARLY CONVERSATION: Ask ONLY for the customer's name and what they need help with. Do NOT ask for email, phone, or address yet.
2. MID CONVERSATION: Ask about preferences, budget, and requirements.
3. LATE CONVERSATION: Ask for contact details only when needed to proceed.

CRITICAL RULES:
- NEVER ask for email, phone, or address in the first 2 messages
- Ask only ONE question per response
- Keep responses concise and friendly
- Do NOT mention that you're an AI
- If the customer already provided info naturally, acknowledge and move to next relevant topic"""


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
    
    # Build the full prompt with progressive collection strategy
    full_prompt = f"{system_prompt}\n\nCustomer message: {message}\n\nRespond helpfully with a single question or statement:"
    
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