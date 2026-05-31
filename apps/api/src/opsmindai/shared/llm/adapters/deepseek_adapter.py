from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.generators import openai_compatible_generate
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.base.provider import BaseLLMProvider


class DeepseekAdapter(BaseLLMProvider):
    name = "deepseek"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or settings.deepseek_model
        api_key = request.metadata.get("api_key") or settings.deepseek_api_key
        base_url = request.metadata.get("base_url") or settings.deepseek_base_url
        return await openai_compatible_generate(
            provider="deepseek",
            base_url=base_url,
            api_key=api_key,
            model=model,
            request=request,
            extra_headers={"HTTP-Referer": "https://opsmindai.local", "X-Title": "OpsMindAI"},
        )
