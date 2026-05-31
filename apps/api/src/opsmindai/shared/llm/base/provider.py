from abc import ABC, abstractmethod

from opsmindai.shared.llm.base.models import LLMRequest, LLMResponse


class BaseLLMProvider(ABC):
    name: str

    @abstractmethod
    async def generate(self, request: LLMRequest) -> LLMResponse:
        raise NotImplementedError
