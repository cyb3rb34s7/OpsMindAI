from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "OpsMindAI"
    environment: str = "development"

    database_path: str = "./opsmindai.db"
    llm_provider: str = "openrouter"

    # GitHub integration (real context-repo creation).
    # Demo uses a single shared PAT; the credential provider seam lets this be
    # swapped for per-customer GitHub App installation tokens in production.
    github_token: str | None = None
    github_api_url: str = "https://api.github.com"
    # Demo host repo (owner/repo) the agent commits per-customer context into.
    # In production this is replaced by a per-customer GitHub App repo.
    github_context_repo: str | None = None
    context_repo_path_prefix: str = "customers"
    large_repo_file_threshold: int = 500

    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    groq_api_key: str | None = None
    openrouter_api_key: str | None = None
    deepseek_api_key: str | None = None

    bedrock_region: str = "us-east-1"
    bedrock_model: str = "anthropic.claude-3-5-sonnet-20240620-v1:0"

    openai_base_url: str = "https://api.openai.com/v1"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    ollama_base_url: str = "http://localhost:11434"

    openai_model: str = "gpt-4.1-mini"
    anthropic_model: str = "claude-3-5-sonnet-latest"
    groq_model: str = "llama-3.3-70b-versatile"
    groq_fallback_models: str = "llama-3.1-8b-instant"
    openrouter_model: str = "openai/gpt-4.1-mini"
    # Comma-separated fallbacks tried (in order) when the primary model is
    # congested (429) — free models have independent throttling, so failover
    # turns a flaky single model into a reliable run.
    openrouter_fallback_models: str = (
        "deepseek/deepseek-chat-v3.1:free,meta-llama/llama-3.3-70b-instruct:free"
    )
    deepseek_model: str = "deepseek-chat"
    ollama_model: str = "llama3.1"

    request_timeout_seconds: int = 60
    max_cognitive_iterations: int = 4

    model_config = SettingsConfigDict(
        env_file=".env",
        # Ignore unrelated env vars (e.g. Railway/host-injected PORT, RAILWAY_*) so
        # the app boots in any deploy environment instead of erroring on extras.
        extra="ignore",
    )


settings = Settings()
