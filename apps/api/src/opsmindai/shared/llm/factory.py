from opsmindai.shared.llm.registry import LLM_PROVIDER_REGISTRY


class LLMFactory:
    @staticmethod
    def create(provider: str):
        provider_class = LLM_PROVIDER_REGISTRY.get(provider)
        if provider_class is None:
            raise ValueError(f"Unsupported provider: {provider}")
        return provider_class()
