from opsmindai.shared.llm.adapters.bedrock_adapter import BedrockAdapter
from opsmindai.shared.llm.adapters.claude_adapter import ClaudeAdapter
from opsmindai.shared.llm.adapters.deepseek_adapter import DeepseekAdapter
from opsmindai.shared.llm.adapters.groq_adapter import GroqAdapter
from opsmindai.shared.llm.adapters.ollama_adapter import OllamaAdapter
from opsmindai.shared.llm.adapters.openai_adapter import OpenAIAdapter
from opsmindai.shared.llm.adapters.openrouter_adapter import OpenrouterAdapter

LLM_PROVIDER_REGISTRY = {
    "openai": OpenAIAdapter,
    "claude": ClaudeAdapter,
    "bedrock": BedrockAdapter,
    "groq": GroqAdapter,
    "openrouter": OpenrouterAdapter,
    "ollama": OllamaAdapter,
    "deepseek": DeepseekAdapter,
}
