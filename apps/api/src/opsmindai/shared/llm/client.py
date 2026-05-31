from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.factory import LLMFactory


class LLMClient:
    def __init__(self, provider: str | None = None) -> None:
        self.provider_name = provider or settings.llm_provider
        self.provider = LLMFactory.create(self.provider_name)

    async def generate(self, request: LLMRequest) -> LLMResponse:
        return await self.provider.generate(request)
