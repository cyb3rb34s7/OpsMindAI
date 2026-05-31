from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.generators import ollama_generate
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.base.provider import BaseLLMProvider


class OllamaAdapter(BaseLLMProvider):
    name = "ollama"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or settings.ollama_model
        base_url = request.metadata.get("base_url") or settings.ollama_base_url
        return await ollama_generate(base_url=base_url, model=model, request=request)
