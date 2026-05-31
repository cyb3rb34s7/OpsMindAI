# Implementation Log

A record of what was built, the decisions behind it, what was deliberately
mocked, and what was cut — for the OpsMindAI take-home.

## Approach

OpsMindAI was built in phases (see `docs/phase-*.md`):

1. **Foundation** — config, SQLite persistence, structured logging, request tracing.
2. **Provider-agnostic LLM runtime** — one contract, many providers, with retry + failover.
3. **Cognitive runtime** — a structured ReAct loop (`CognitiveRunner`) that selects tools, accumulates memory, and synthesizes a typed final report.
4. **Three agents** — onboarding, RCA, release — each composing the runtime with real/mocked tools.
5. **Convergence** — orchestrator routing, the API surface, persistence, and a gateway.
6. **Product surface** — a landing page + functional console wired to the live API.
7. **Agentic experience** — multi-source onboarding, a 3-tier memory system (FTS5),
   a streaming chat that shows thinking/tools, onboarding-first console gating, and
   a multi-region release bot with a streamed step-by-step rollout.

The guiding principle was to make the parts that demonstrate *real intelligence*
genuinely real (GitHub scanning/commits, trace correlation, skill memory) and to
mock only the parts that are purely operational plumbing (Jenkins, AWS, sanity
scripts) with deterministic, story-driven data.

> For the *chronological* account — the problems hit and how each was solved
> (throttling → golden cache, Ollama empty output → `num_predict` floor, the gating
> race, the release-console rework) — see **`BUILD_JOURNAL.md`**.

## Key decisions

**Provider-agnostic LLM layer.** The model is a swappable adapter (`groq`,
`openrouter`, `openai`, `claude`, `bedrock`, `ollama`, `deepseek`) behind one
`LLMClient`. This directly answers the "what drives pricing" question — model
choice is a one-line config change, so you run a cheap/free model in dev and a
stronger one in prod.

**Retry + model failover.** Free models throttle aggressively under the cognitive
loop's several sequential calls. The OpenAI-compatible generator does jittered
exponential backoff on 429/5xx, then fails over to alternate models. A congested
model degrades to "slower," never to "failed." (Also serves as the rate-limit
edge case.)

**Schema-tolerant cognition.** Weaker models don't always emit the exact
`CognitiveStep` shape. Rather than crash the run, `CognitiveStep` defaults every
field — a malformed step simply ends the loop and proceeds to final synthesis.
This is what lets the system run reliably on free models.

**GitHub credential seam.** Context-repo creation goes through a
`GitHubCredentialProvider` keyed by `customer_id`. The demo resolves a single
shared PAT; the production path is GitHub App installation tokens (store an
`installation_id` per customer, mint a short-lived org-scoped token per request).
Swapping demo → production is local to that one class — the rest of the code only
depends on `get_token(customer_id)`.

**Per-customer context model.** With a fine-grained PAT (scoped to selected
repos, can't create new ones), the demo commits each customer's artifacts into a
folder (`customers/<id>/`) of one host repo. In production with a GitHub App,
each customer gets their own repo — same commit code, different target.

## Wow factors (all real)

1. **Real GitHub context repo.** Onboarding scans the live repo via the GitHub
   REST API (tree, README, languages, config detection) and commits real markdown
   artifacts to GitHub — a browsable repo the team can read and edit.
2. **Self-improving skill memory.** Each resolved RCA is persisted as a skill
   (`customer_id + failure_pattern`). On the next similar incident, matching
   skills are loaded into the agent's prompt; repeated incidents reinforce the
   playbook and raise confidence (observed 0.6 → 0.8 on the second occurrence).
3. **Cross-service trace correlation.** The trace tool reconstructs an ordered
   timeline from logs, computes per-hop timing deltas, and pinpoints the first
   error — e.g. "first failure at payment-service (+10s): redis connection
   dropped," across auth → cache → payment → checkout → gateway.

## Edge cases handled

- **Large codebase** — if the file tree exceeds a threshold (or GitHub truncates
  it), the scanner keeps only top-level + config files and emits a warning rather
  than reading everything.
- **Missing context** — RCA refuses to run before onboarding exists for a tenant
  ("Run onboarding first or provide manual context").
- **Tool failure** — a failed tool returns a structured error; the runner records
  it and continues to partial synthesis instead of crashing.
- **Rate-limit / provider congestion** — backoff + model failover (above).
- **Loop bound** — the ReAct loop has a hard `max_iterations` cap, then always
  produces a final report from what it gathered.

## What is mocked vs real

Real: GitHub scan, GitHub context-repo commits, RCA reasoning, trace correlation,
skill persistence/recall, 3-tier memory (FTS5 BM25 + recency/importance), SSE
streaming for chat and the release rollout, the onboarding golden cache, run
persistence, multi-tenant `customer_id` threading, local + hosted LLM providers.

Mocked (deterministic, demo-friendly): service logs (a coherent `trace_123`
failure chain), AWS config validation, Jenkins deploy (now multi-region), sanity
scripts, startup telemetry — each with `healthy` / `degraded` / `blocked`
scenarios.

**Telegram gateway is real** — connect your own bot (validated via `getMe`),
long-polling for messages (the self-hosted default, same as Hermes/OpenClaw), each
chat run through the same agent pipeline and mirrored as a live session in the
dashboard. One poller per tenant, resumed on startup; webhook mode is the
documented cloud path.

## What was cut, and why

- **Real Jenkins/AWS/SDK calls** — mocked per the brief; the agent reasoning over
  their output is the interesting part, and is real.
- **Job queue / worker pool** — designed for (documented under scaling) but not
  built; single-process is enough for a demo.
- **Auth / tenant isolation enforcement** — `customer_id` is threaded everywhere
  and isolates data, but there is no login layer.

## Known limitations / next steps

- Free-model latency: runs take ~10–20s under failover; a paid model removes this.
- Skill matching is keyword-overlap, not embeddings — fine at demo scale.
- The cognitive loop occasionally re-invokes a tool it already has results for;
  onboarding caps iterations low to avoid the waste.
- Next: GitHub App credentials, a worker queue for concurrency, and per-tenant
  token accounting surfaced in the dashboard.
