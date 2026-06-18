from typing import Any
import logging
import httpx

logger = logging.getLogger(__name__)


class GeminiProvider:
    def __init__(self, api_key: str):
        self.api_key = api_key

    async def generate(self, model: str, prompt: str, max_tokens: int = 512) -> str:
        model_name = model
        if not model_name.startswith("models/"):
            model_name = f"models/{model_name}"

        url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={self.api_key}"
        headers = {
            "Content-Type": "application/json",
        }
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt}
                    ]
                }
            ],
            "generationConfig": {
                "maxOutputTokens": max_tokens
            }
        }

        logger.info("[Gemini] POST %s model=%s max_tokens=%d", url.split("?")[0], model, max_tokens)

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code != 200:
                logger.error(
                    "[Gemini] HTTP %d — body: %s", resp.status_code, resp.text[:500]
                )
            resp.raise_for_status()
            data = resp.json()

        candidates = data.get("candidates") or []
        if candidates:
            candidate = candidates[0]
            content = candidate.get("content") or {}
            parts = content.get("parts") or []
            if parts:
                text = parts[0].get("text") or ""
                logger.info("[Gemini] Reply (%d chars): %s", len(text), text[:120])
                return text

        logger.warning("[Gemini] Unexpected response shape: %s", str(data)[:300])
        return str(data)
