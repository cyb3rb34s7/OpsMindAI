# OpsMindAI

AI-powered DevOps agent platform.

## What is included
- FastAPI backend
- provider-agnostic LLM runtime
- orchestrator + specialized agents
- SQLite run persistence
- tool registry
- execution traces and report artifacts

## API
- `POST /api/v1/orchestrator/run`
- `POST /api/v1/agents/{agent_name}`
- `GET /api/v1/runs`
- `GET /api/v1/runs/{run_id}`
- `GET /api/v1/traces/{trace_id}`
- `GET /health`

## Provider configuration
Set `OPSMINDAI_LLM_PROVIDER` to one of:
`openai`, `claude`, `bedrock`, `groq`, `openrouter`, `ollama`, `deepseek`

Provider API keys are optional at startup and required only when that provider is used.
