# OpsMindAI

AI-powered DevOps agent platform. OpsMindAI gives an engineering team three
autonomous agents — **Onboarding**, **RCA**, and **Release** — behind a single
orchestrator, plus a self-improving skill memory. It scans real repositories,
reads logs, correlates traces, and gates deployments.

> Built from first principles: a provider-agnostic LLM runtime, a structured
> cognitive (ReAct) loop, real GitHub integration, and a "Kinetic Command"
> dashboard.

---

## What it does

| Surface | Description |
|---|---|
| **Onboarding agent** | Scans a real GitHub repo, infers the operational shape, and commits a structured **context repo** (project index, tech stack, service map, open questions, decision tree) to GitHub. |
| **RCA agent** | Takes an incident trace ID, correlates logs into a timed causal chain across services, pinpoints where it broke, and proposes a fix. Applies skills learned from past incidents. |
| **Release agent** | Validates AWS config, monitors startup, runs sanity checks, and gates the deploy (healthy → ship, blocked → rollback). |
| **Orchestrator** | Classifies a natural-language request and routes it to the right agent. |
| **Skill memory** | Every resolved RCA is saved as a skill and reloaded on the next similar incident — the agent gets measurably more confident over time. |

---

## Architecture

```
apps/
├── api/                     # FastAPI backend (Python 3.12)
│   └── src/opsmindai/
│       ├── runtime/         # CognitiveRunner — structured ReAct loop
│       ├── agents/          # onboarding · rca · release · orchestrator + base/cognition
│       ├── tools/           # github (real) · logs · traces · aws · jenkins · sanity · startup
│       ├── modules/         # API routers + services (agents, orchestrator, runs, skills, telegram)
│       └── shared/          # config · sqlite db · provider-agnostic LLM layer
└── web/                     # Vite + React + Tailwind v4 dashboard (landing + console)
```

The LLM layer is **provider-agnostic** (OpenRouter / Groq / OpenAI / Claude /
Bedrock / Ollama / DeepSeek) with automatic **retry + model failover** so a
congested free model never fails a run.

---

## Setup

### Prerequisites
- Python 3.12
- Node 18+ (Node 24 tested)
- A free **Groq** API key (`console.groq.com`) — fast, reliable, no daily cap
- A GitHub **fine-grained PAT** with `Contents: write` on the repo that hosts
  context artifacts (the demo commits per-customer folders into one host repo)

### 1. Backend

```bash
cd apps/api
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt   # fastapi uvicorn pydantic pydantic-settings httpx boto3

# Create apps/api/.env  (only these keys — config forbids unknown keys):
#   llm_provider=groq
#   groq_api_key=YOUR_GROQ_KEY
#   github_token=YOUR_FINEGRAINED_PAT
#   github_context_repo=owner/your-context-repo

$env:PYTHONPATH="src"
.venv\Scripts\python -m uvicorn opsmindai.main:app --host 127.0.0.1 --port 8077
```

Backend is live at `http://127.0.0.1:8077` (`GET /health` to verify).

### 2. Frontend

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173  (proxies /api → :8077)
```

Open `http://localhost:5173`, click **Launch Console**, and drive the agents.

---

## API

- `POST /api/v1/orchestrator/run` — `{customer_id, message}` → routed result
- `POST /api/v1/agents/onboarding` — `{customer_id, payload:{repo_url}}`
- `POST /api/v1/agents/rca` — `{customer_id, payload:{trace_id, description}}`
- `POST /api/v1/agents/release` — `{customer_id, payload:{service, version, demo_mode}}`
- `GET  /api/v1/skills/{customer_id}` — accumulated skill playbook
- `GET  /api/v1/runs` · `GET /api/v1/runs/{run_id}` — run history
- `GET  /health`

---

## What is real vs mocked

| Component | Status |
|---|---|
| GitHub repo scanning | **Real** — GitHub REST API (tree, README, languages, config detection) |
| Context repo creation | **Real** — commits markdown to an actual GitHub repo |
| RCA reasoning + trace correlation | **Real** — agent reasons over correlated logs |
| Skill memory (learn + reapply) | **Real** — persisted in SQLite, reloaded into prompts |
| Service logs | Mocked — deterministic, story-driven (`trace_123`) |
| AWS config / Jenkins / sanity / startup | Mocked — `healthy` / `blocked` scenarios |
| Telegram | Stubbed webhook passthrough |

See `IMPLEMENTATION_LOG.md` for decisions, edge cases, and what was cut.
A guided walkthrough is in `DEMO.md`.
