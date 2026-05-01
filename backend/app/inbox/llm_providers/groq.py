from typing import Any
import logging
import httpx

logger = logging.getLogger(__name__)

GROQ_API_BASE = "https://api.groq.com/openai/v1"

# Keep this list aligned with Groq's supported production models.
SUPPORTED_GROQ_MODELS = (
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
)

DEFAULT_GROQ_MODEL = SUPPORTED_GROQ_MODELS[0]


class GroqProvider:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, model: str, prompt: str, max_tokens: int = 512) -> str:
        url = f"{GROQ_API_BASE}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }

        logger.info("[Groq] POST %s model=%s max_tokens=%d", url, model, max_tokens)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                logger.error(
                    "[Groq] HTTP %d — body: %s", resp.status_code, resp.text[:500]
                )
            resp.raise_for_status()
            data = resp.json()

        choices = data.get("choices") or []
        if choices:
            msg = choices[0].get("message") or {}
            text = msg.get("content") or ""
            logger.info("[Groq] Reply (%d chars): %s", len(text), text[:120])
            return text

        logger.warning("[Groq] Unexpected response shape: %s", str(data)[:300])
        return str(data)
