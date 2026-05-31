from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.generators import openai_compatible_generate
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.base.provider import BaseLLMProvider


class OpenAIAdapter(BaseLLMProvider):
    name = "openai"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or settings.openai_model
        api_key = request.metadata.get("api_key") or settings.openai_api_key
        base_url = request.metadata.get("base_url") or settings.openai_base_url
        return await openai_compatible_generate(
            provider="openai",
            base_url=base_url,
            api_key=api_key,
            model=model,
            request=request,
        )
