from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.generators import openai_compatible_generate
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.base.provider import BaseLLMProvider


class GroqAdapter(BaseLLMProvider):
    name = "groq"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or settings.groq_model
        api_key = request.metadata.get("api_key") or settings.groq_api_key
        base_url = request.metadata.get("base_url") or settings.groq_base_url
        fallbacks = [
            m.strip()
            for m in (settings.groq_fallback_models or "").split(",")
            if m.strip() and m.strip() != model
        ]
        return await openai_compatible_generate(
            provider="groq",
            base_url=base_url,
            api_key=api_key,
            model=model,
            request=request,
            extra_headers={"HTTP-Referer": "https://opsmindai.local", "X-Title": "OpsMindAI"},
            fallback_models=fallbacks,
        )
