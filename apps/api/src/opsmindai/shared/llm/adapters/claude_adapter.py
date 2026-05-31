from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.generators import anthropic_generate
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.base.provider import BaseLLMProvider


class ClaudeAdapter(BaseLLMProvider):
    name = "claude"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or settings.anthropic_model
        api_key = request.metadata.get("api_key") or settings.anthropic_api_key
        return await anthropic_generate(
            api_key=api_key,
            model=model,
            request=request,
        )
