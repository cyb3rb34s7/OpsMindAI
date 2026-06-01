# Deploy

**Live demo:** https://opsmindai-demo-production.up.railway.app

OpsMindAI ships as a **single container**: a multi-stage `Dockerfile` builds the React
SPA, then FastAPI serves it at `/` alongside the `/api` routes — one public URL, no
CORS, no separate web host. Telegram uses long-polling (outbound), so no public webhook
is needed.

## How it's wired
- `Dockerfile` (repo root) — stage 1 builds `apps/web` → `dist`; stage 2 installs the
  Python API, copies the built SPA to `/app/web`, and runs uvicorn on `$PORT`.
- `main.py` mounts the SPA via `StaticFiles` when `WEB_DIST` is set (production); in dev
  it's unset and Vite serves the frontend with an `/api` proxy.
- `railway.json` pins the Dockerfile builder.
- `.dockerignore` keeps `node_modules`, `.venv`, `storage`, `*.db`, and `.env` out of
  the build context.

## Hosted on Railway (CLI, no GitHub needed)
```bash
railway login
railway link -p opsmindai-demo          # or: railway init --name <name>
railway up --ci                          # build the image remotely + deploy
railway domain                           # generate the public URL
```

Environment variables (set on the service, never committed):
```
llm_provider=groq          # fast hosted inference for the live demo
groq_api_key=...
github_token=...           # so onboarding still creates real context repos
github_context_repo=owner/repo
openrouter_api_key=...     # optional failover
```

Redeploy after a code change: `railway up --ci` (env-only change: `railway variables --set k=v` triggers a redeploy).

## Notes
- **Provider:** Groq in production (no local Ollama on the server) — turns are ~2-4s, so
  the step pacing feels snappy. Local dev can still use Ollama for rate-limit-free testing.
- **Persistence:** SQLite + context repos are **ephemeral** (reset on redeploy). The
  first visitor onboards (golden cache makes repeat onboards instant); learned facts and
  skills accumulate until the next redeploy. Attach a Railway volume to persist them.
- **Telegram on the live site:** connect a bot from the sidebar — it polls from Railway.
  Don't point the *same* bot token at both a local and the deployed instance at once
  (Telegram allows only one `getUpdates` consumer per token).
