from opsmindai.shared.config import settings
from opsmindai.shared.llm.base.generators import bedrock_generate
from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse
from opsmindai.shared.llm.base.provider import BaseLLMProvider


class BedrockAdapter(BaseLLMProvider):
    name = "bedrock"

    async def generate(self, request: LLMRequest) -> LLMResponse:
        model = request.metadata.get("model") or settings.bedrock_model
        region = request.metadata.get("region") or settings.bedrock_region
        return await bedrock_generate(region=region, model=model, request=request)
