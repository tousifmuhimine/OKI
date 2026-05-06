"""
AI-powered lead conversion service
Converts raw agent notes into structured Lead objects using Groq API.

Uses the "Direct-Entry" prompt logic:
  - Identifies industry (Real Estate / Study Abroad / Ecommerce)
  - Extracts global fields: name, email, phone
  - Extracts industry-specific fields into `industry_data`
"""
import json
from typing import Optional
import httpx

from app.core.config import settings
from app.schemas.lead import LeadCreate


# Supported industry slugs (must match frontend select options)
INDUSTRY_SLUGS = {
    "real_estate": "Real Estate",
    "study_abroad": "Study Abroad",
    "ecommerce": "Ecommerce",
    "agro": "Agro",
    "manufacture": "Manufacture",
}


async def convert_notes_to_lead(raw_notes: str, api_key: str) -> Optional[LeadCreate]:
    """
    Convert raw agent notes into a structured Lead object using Groq API.

    Implements the "Direct-Entry" prompt template:
      1. Identifies the industry.
      2. Extracts name, email, phone_number.
      3. Extracts industry-specific fields into `industry_data`.

    Args:
        raw_notes: Raw text notes from agent/customer interactions
        api_key: The organization-specific Groq API key

    Returns:
        LeadCreate schema with extracted fields (including industry_data), or None if extraction fails.
    """
    if not api_key:
        return None

    prompt = f"""Act as a professional CRM data officer in Bangladesh. Analyze the note: '{raw_notes}'.

1. Identify the industry. It must be one of: real_estate, study_abroad, ecommerce, agro, manufacture. If not clearly identifiable, use null.
2. Extract:
   - company_name (string, required — use contact name if no company)
   - contact_person (string, optional)
   - name (string, optional — full name of the lead contact)
   - email (string, optional)
   - phone (string, optional — phone number)
   - address (string, optional)
   - source (string, optional — one of: manual, website, outbound, referral. Default: manual)
   - notes (string, optional — cleaned summary)
3. Extract industry-specific fields into "industry_data":
   - If Real Estate: {{ "company_name": ..., "budget": <number|null>, "square_feet": <number|null> }}
   - If Study Abroad: {{ "preferred_country": <"UK"|"US"|"AUS"|"CA"|null>, "financial_status": <string|null> }}
   - If Ecommerce: {{ "product_interest": <string|null>, "delivery_location": <string|null>, "urgency_level": <"Low"|"Medium"|"High"|null>, "preferred_platform": <"Messenger"|"WhatsApp"|null> }}
   - Otherwise: {{}}

Return a single clean JSON object ready for Supabase insertion, with NO markdown, NO code fences, just raw JSON:
{{
  "company_name": "...",
  "contact_person": "...",
  "name": "...",
  "email": "...",
  "phone": "...",
  "address": "...",
  "industry": "real_estate|study_abroad|ecommerce|agro|manufacture|null",
  "source": "manual",
  "notes": "...",
  "industry_data": {{ ... }}
}}"""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt,
                        }
                    ],
                    "temperature": 0.2,
                    "max_tokens": 700,
                },
                timeout=15.0,
            )

            if response.status_code != 200:
                return None

            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "").strip()

            # Strip markdown fences if the model wraps them despite instructions
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()

            try:
                extracted_data = json.loads(content)
            except json.JSONDecodeError:
                return None

            # Ensure we have at least a company name to anchor the lead
            company_name = extracted_data.get("company_name") or extracted_data.get("name")
            if not company_name:
                return None

            industry_data = extracted_data.get("industry_data") or {}

            return LeadCreate(
                company_name=company_name,
                contact_person=extracted_data.get("contact_person") or extracted_data.get("name"),
                phone=extracted_data.get("phone"),
                email=extracted_data.get("email"),
                address=extracted_data.get("address"),
                industry=extracted_data.get("industry"),
                notes=extracted_data.get("notes") or raw_notes,
                source=extracted_data.get("source", "manual"),
                status="new",
                industry_data=industry_data if industry_data else None,
                raw_note=raw_notes,
            )

    except Exception:
        return None
