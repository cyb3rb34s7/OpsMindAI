# Demo Walkthrough

A deterministic ~5-minute walkthrough. Backend on `:8077`, web on `:5173`.

## Setup (once)
1. Backend running (`uvicorn opsmindai.main:app --port 8077`) with `.env` set
   (`llm_provider=groq`, `groq_api_key`, `github_token`, `github_context_repo`).
2. Web running (`npm run dev`), open `http://localhost:5173`.

## Script

### 0. Landing page (15s)
Open the site. Scroll the landing page — hero, the live onboarding sequencer,
and the three console showcases (Investigation, Release, Knowledge). This is the
marketing front door. Click **Launch Console**.

### 1. Onboarding — real GitHub context repo (60s)
- You're on the **Onboarding** console. The repo URL is pre-filled
  (`https://github.com/lootsblog/IntelliParse`).
- Click **Initialize Discovery**. The agent runs live (~10–20s).
- Result: real **tech stack**, **services**, and **open questions** inferred from
  the actual codebase, plus a **Context Repository** card.
- Click the repo link — it opens a **real GitHub repo** with the committed
  markdown under `customers/acme/` (README, project_index, tech_stack,
  service_map, open_questions, decision_tree).
- **Talking point:** the scan and the commit are both real GitHub API calls. In
  production each customer gets their own repo via a GitHub App (credential seam).

### 2. RCA — trace correlation + self-improving memory (60s)
- Open **Investigation**. Trace `trace_123` is pre-filled. Click **Investigate**.
- Result: a **timed trace timeline** — auth (+0s) → cache warn (+4s) →
  **payment-service error (+10s, redis dropped)** → checkout (+12s) → gateway.
  The break point is highlighted.
- Root cause + 80% confidence + recommended actions.
- **Run it again.** Watch the **Self-Improving Memory** banner: "Applied a learned
  skill … seen N×" — the agent recognized the pattern from the prior run and the
  skill counter increments.
- **Talking point:** every resolved incident is persisted and reloaded next time;
  the agent gets more confident with each occurrence.

### 3. Knowledge — the learned playbook (30s)
- Open **Knowledge**. The **Learned Skills (SRE Playbook)** shows the real skill
  the RCA agent accumulated (failure pattern, resolution, reuse count, confidence).
- Type a question (e.g. "our checkout is throwing 500s, can you investigate?") and
  click **Ask** — the **orchestrator** classifies intent and routes to the RCA
  agent with a confidence score and reasoning.

### 4. Release — the deploy gate (45s)
- Open **Releases**. Leave scenario on **healthy**, click **Run Release Gate** →
  pipeline goes green, risk **Low**, cleared for rollout.
- Switch scenario to **blocked**, run again → the agent catches *"Security group
  allows public database access,"* risk **High**, **Rollback** recommended.
- **Talking point:** AWS/Jenkins are mocked, but the agent's risk reasoning over
  their output is real.

### 5. Chat — Mindy, the conversational DevOps agent (60s)
- Open **Chat**. You're talking to **Mindy**, the orchestrator — she has an identity,
  her own read-only ops tools, and delegates to the specialists.
- Type **"check my server health for payment-service"** → she runs a **status check**
  (watch the tool chip) and replies *"✅ payment-service is healthy — 3/3 regions up,
  latency ~57ms."* (Not "give me a trace ID" — that was the old router.)
- Type **"is cartservice ok?"** → *"⚠️ cartservice is degraded — eu-west-1 failing its
  readiness probe (Redis connection refused)… I can run a full root-cause investigation
  — just say the word 🔍."*
- Take her up on it: **"yes, investigate trace_123"** → she **delegates to RCA**, which
  returns the timed trace timeline + root cause + confidence.
- **Talking point:** the orchestrator *checks and reports* but never resolves —
  resolution is the RCA agent's job. One agent, clear boundaries, real hand-off.

### 6. Telegram gateway — same agent, in your pocket (45s)
- In the sidebar, click **Connect Telegram**, paste a bot token from `@BotFather`.
- Message the bot: **"check payment-service health"** → Mindy answers from Telegram,
  with a live **"💭 Working on it…"** loader that edits into the reply.
- Back in the app, open the **Telegram** view → the conversation appears as a **live
  session** (the bot and the dashboard share one brain and one memory).
- **Talking point:** long-polling (no public URL needed), the same `run_turn` pipeline,
  one poller per tenant, resumed on restart.

## Edge cases to show (optional, 30s)
- **Missing context:** open Investigation for a fresh tenant before onboarding →
  the agent refuses with "Run onboarding first" (surfaced as an error banner).
- **Large codebase:** onboard a big repo → the scanner warns it scanned top-level
  + config files only.
- **Provider congestion:** if a model 429s, the run still completes via backoff +
  failover (visible as a slightly longer run, never a failure).

## One-line pitch
"Marketing front door → sign in → talk to Mindy, a DevOps agent who checks service
health, root-causes incidents across traces, learns from every fix, runs multi-region
releases, and lives in your Telegram too — real agents behind one orchestrator,
provider-agnostic by design."
