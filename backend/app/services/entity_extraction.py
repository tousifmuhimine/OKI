"""Entity extraction service for lead data from conversations."""

import json
import logging
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.models import UserLLMConfig, Lead
from app.inbox.llm_providers.groq import GroqProvider, DEFAULT_GROQ_MODEL
from app.inbox.security import decrypt_channel_config

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """You are a data extraction expert. Extract structured information from the given message.

Extract the following fields if mentioned:
- name: Full name or company name mentioned
- phone: Phone number (any format)
- email: Email address
- address: Full address or location
- budget: Numeric budget amount (extract just the number, no currency)

Return ONLY valid JSON with these exact keys. Use null for missing fields.
Example: {{"name": "John Doe", "phone": "+1234567890", "email": "john@example.com", "address": "123 Main St", "budget": 50000}}

Message to extract from:
{message}

Return only the JSON object, no other text."""


INTENT_PROMPT = """You are a lead intent classifier.

Classify the user's intent into exactly one of these labels:
- browsing: general interest, exploring options, asking broad questions
- comparing: evaluating options, comparing prices/features, shortlisting
- serious: strong purchase intent, ready to act, asks for next steps, pricing, demo, visit, or payment

Return ONLY valid JSON with this exact shape:
{{"intent": "browsing|comparing|serious"}}

Message:
{message}

Return only the JSON object, no other text."""


class ExtractedEntity:
    """Container for extracted entities."""
    def __init__(self, data: dict):
        self.name = data.get("name")
        self.phone = data.get("phone")
        self.email = data.get("email")
        self.address = data.get("address")
        self.budget = data.get("budget")
    
    def to_dict(self):
        """Return as dict with only non-None values."""
        return {
            k: v for k, v in {
                "name": self.name,
                "phone": self.phone,
                "email": self.email,
                "address": self.address,
                "budget": self.budget,
            }.items()
            if v is not None
        }


class ClassifiedIntent:
    """Container for classified intent."""

    def __init__(self, intent: str | None):
        self.intent = intent


def _parse_json_response(response_text: str) -> dict:
    """Parse a JSON object from an AI response."""
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        import re

        json_match = re.search(r"\{[^}]+\}", response_text)
        if json_match:
            return json.loads(json_match.group())
        logger.warning("Could not parse JSON from response: %s", response_text[:200])
        return {}


async def _get_groq_response(
    session: AsyncSession,
    *,
    message: str,
    workspace_id: str,
    user_id: str,
    prompt_template: str,
    max_tokens: int = 256,
) -> str:
    """Load the user's AI configuration and request a Groq completion."""
    stmt = select(UserLLMConfig).where(
        UserLLMConfig.workspace_id == workspace_id,
        UserLLMConfig.user_id == user_id,
    )
    result = await session.execute(stmt)
    config = result.scalar_one_or_none()

    if not config:
        raise ValueError(f"No AI provider configured for user {user_id}")

    if config.provider.lower() != "groq":
        raise ValueError(f"AI provider '{config.provider}' not yet supported")

    try:
        decrypted_config = decrypt_channel_config(config.encrypted_config)
        api_key = decrypted_config.get("api_key")
        if not api_key:
            raise ValueError("API key not found in decrypted config")
    except Exception as e:
        logger.error("Failed to decrypt AI config: %s", e)
        raise ValueError("Failed to decrypt AI configuration")

    model = config.model_preferences.get("default") or config.default_model or DEFAULT_GROQ_MODEL
    prompt = prompt_template.format(message=message)

    provider = GroqProvider(api_key)
    return await provider.generate(model=model, prompt=prompt, max_tokens=max_tokens)


async def extract_entities_from_message(
    session: AsyncSession,
    *,
    message: str,
    workspace_id: str,
    user_id: str,
) -> ExtractedEntity:
    """Extract structured entities from a message using AI.
    
    Args:
        session: Database session
        message: The message to extract entities from
        workspace_id: Workspace ID
        user_id: User ID (to load their AI config)
    
    Returns:
        ExtractedEntity with name, phone, email, address, budget
        
    Raises:
        ValueError: If no AI provider is configured or extraction fails
    """
    # Generate extraction using Groq
    try:
        response = await _get_groq_response(
            session,
            message=message,
            workspace_id=workspace_id,
            user_id=user_id,
            prompt_template=EXTRACTION_PROMPT,
        )

        data = _parse_json_response(response.strip())
        
        logger.info(f"[Entity Extraction] Extracted from message: {data}")
        return ExtractedEntity(data)
        
    except Exception as e:
        logger.error(f"Failed to extract entities: {e}")
        raise ValueError(f"Failed to extract entities: {str(e)}")


async def update_lead_from_extracted_entities(
    session: AsyncSession,
    lead_id: str,
    entities: ExtractedEntity,
) -> Lead:
    """Update a lead with extracted entity data.
    
    Args:
        session: Database session
        lead_id: Lead ID to update
        entities: Extracted entities
        
    Returns:
        Updated Lead object
        
    Raises:
        ValueError: If lead not found
    """
    lead = await session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")
    
    # Update fields if extracted values are present and lead field is empty
    if entities.name and not lead.company_name:
        lead.company_name = entities.name
        logger.info(f"Updated lead company_name: {entities.name}")
    
    if entities.phone and not lead.phone:
        lead.phone = entities.phone
        logger.info(f"Updated lead phone: {entities.phone}")
    
    if entities.email and not lead.email:
        lead.email = entities.email
        logger.info(f"Updated lead email: {entities.email}")
    
    if entities.address and not lead.address:
        lead.address = entities.address
        logger.info(f"Updated lead address: {entities.address}")
    
    if entities.budget and not lead.budget_max:
        try:
            budget_val = float(entities.budget)
            lead.budget_max = budget_val
            logger.info(f"Updated lead budget_max: {budget_val}")
        except (ValueError, TypeError):
            logger.warning(f"Could not convert budget to float: {entities.budget}")
    
    await session.flush()
    return lead


async def detect_intent_from_message(
    session: AsyncSession,
    *,
    message: str,
    workspace_id: str,
    user_id: str,
) -> ClassifiedIntent:
    """Classify a message into browsing, comparing, or serious intent."""
    try:
        response = await _get_groq_response(
            session,
            message=message,
            workspace_id=workspace_id,
            user_id=user_id,
            prompt_template=INTENT_PROMPT,
        )
        data = _parse_json_response(response.strip())
        intent = data.get("intent")
        if intent not in {"browsing", "comparing", "serious"}:
            logger.warning("Unexpected intent classification: %s", intent)
            intent = None
        logger.info("[Intent Detection] Classified message as: %s", intent)
        return ClassifiedIntent(intent)
    except Exception as e:
        logger.error("Failed to detect intent: %s", e)
        raise ValueError(f"Failed to detect intent: {str(e)}")


async def update_lead_intent(
    session: AsyncSession,
    lead_id: str,
    intent: str,
) -> Lead:
    """Update a lead's intent field."""
    lead = await session.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} not found")

    lead.intent = intent
    await session.flush()
    return lead
