from typing import Any
import logging
import httpx

logger = logging.getLogger(__name__)

OPENAI_API_BASE = "https://api.openai.com/v1"


class OpenAIProvider:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, model: str, prompt: str, max_tokens: int = 512) -> str:
        url = f"{OPENAI_API_BASE}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": max_tokens,
        }

        logger.info("[OpenAI] POST %s model=%s max_tokens=%d", url, model, max_tokens)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                logger.error(
                    "[OpenAI] HTTP %d — body: %s", resp.status_code, resp.text[:500]
                )
            resp.raise_for_status()
            data = resp.json()

        choices = data.get("choices") or []
        if choices:
            msg = choices[0].get("message") or {}
            text = msg.get("content") or ""
            logger.info("[OpenAI] Reply (%d chars): %s", len(text), text[:120])
            return text

        logger.warning("[OpenAI] Unexpected response shape: %s", str(data)[:300])
        return str(data)
