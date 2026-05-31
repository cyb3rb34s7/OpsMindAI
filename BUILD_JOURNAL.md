# Build Journal — OpsMindAI

An honest, chronological account of how I built OpsMindAI: the order I worked in,
the problems I hit, what I tried, the decisions I made, and how each turned out.

It's written as an iteration log on purpose — the interesting part of this
take-home wasn't any single feature, it was the loop of *build → demo it to
myself → find where it breaks or feels wrong → fix the root cause*.

Every phase below maps to real commits, so this narrative is verifiable against
`git log --oneline` (hashes are quoted inline).

---

## The brief, and my one guiding rule

The task: build "OpsMindAI" — an AI DevOps agent that onboards onto a system,
investigates incidents, and runs releases — from first principles.

I set one rule before writing any code, and it shaped every decision after:

> **Make the parts that demonstrate real intelligence genuinely real. Mock only
> the operational plumbing — and even then, with deterministic, story-driven
> data so a demo is repeatable.**

So the GitHub scan, the trace correlation, the skill memory, the agent reasoning:
real. Jenkins, AWS, sanity scripts, startup telemetry: mocked behind the same
interfaces a real integration would use, with `healthy / degraded / blocked`
scenarios I can trigger on demand.

---

## Phase 1–2 — Foundation and the LLM runtime

**What I built first** (`132f8eb`, `b9b4dd7`, `4907e31`): config, SQLite
persistence, structured logging, request tracing, then a provider-agnostic LLM
layer and a structured ReAct loop (`CognitiveRunner`) that selects tools,
accumulates working memory, and synthesizes a typed final report.

**Decision — one LLM contract, many providers.** The model is a swappable adapter
(`groq`, `openrouter`, `openai`, `claude`, `bedrock`, `ollama`, `deepseek`) behind
a single `LLMClient`. This directly answers the "what drives pricing" question in
the brief: model choice is a one-line config change, so I can run a free model in
dev and a stronger one in prod without touching agent code. This decision paid off
repeatedly later (it's what let me switch the whole system to local Ollama in an
afternoon).

**Decision — degrade, never crash.** Two early choices made everything downstream
reliable on weak/free models:
- *Retry + failover*: the OpenAI-compatible generator does jittered exponential
  backoff on 429/5xx, then fails over to alternate models. A congested model
  becomes "slower," never "failed."
- *Schema-tolerant cognition*: weak models don't always emit the exact
  `CognitiveStep` shape, so every field defaults — a malformed step just ends the
  loop and proceeds to final synthesis instead of throwing.

---

## Phase 3 — The three agents

Onboarding (`f44a640`), RCA (`4199e2b`), Release (`63557b0`) — each composing the
runtime with real or mocked tools. This is where the three "wow factors" landed:

1. **Real GitHub context repo.** Onboarding scans a live repo via the GitHub REST
   API and commits real markdown artifacts back to GitHub — a browsable repo the
   team can read and edit.
2. **Self-improving skill memory.** Each resolved RCA is persisted as a skill
   (`customer_id + failure_pattern`). On the next similar incident, matching skills
   are loaded into the prompt; confidence climbs on repeat occurrences (I observed
   0.6 → 0.8 on the second incident).
3. **Cross-service trace correlation.** The trace tool reconstructs an ordered
   timeline from logs, computes per-hop timing deltas, and pinpoints the first
   error across a service chain.

---

## Iteration 1 — "Most of this is mocked. Is the context repo actually any good?"

When I demoed onboarding to myself, the context repo was *real* but *shallow* — it
listed file names, not what the code actually did. A reviewer would see through it
immediately.

**Problem:** scanning every file is unbounded (token cost + latency explode on a
big repo), but scanning only names is worthless.

**What I tried → decided** (`98cfd3e`): a *bounded-real* scan. The scanner ranks
files by signal, then reads the **content** of only the top `MAX_CONTENT_FILES = 8`
files, each capped at `CONTENT_CHAR_CAP = 1400` chars. Token cost is fixed
regardless of repo size; the artifacts gained real substance (service maps,
data flows, decision records). I aligned the demo on Google's *Online Boutique*
microservices-demo so the output is recognizably correct.

**Edge case I added here:** if the file tree exceeds a threshold (or GitHub
truncates it), keep only top-level + config files and emit a warning rather than
silently reading a partial tree.

---

## Iteration 2 — "Wouldn't my tokens be exhausted?" → the throttling wall

This was the hardest problem in the project, and the most instructive.

**Problem:** the demo runs on one repo, repeatedly. On Groq's free tier, the large
onboarding LLM call kept hitting TPM throttling and hanging 2–3 minutes — sometimes
my own verification runs stalled out. Unusable for a live demo.

**What I tried, in order:**
1. *Bound the blast radius* (`06d7c72`): wrapped agent runs in
   `asyncio.wait_for(..., timeout=...)` so a throttled provider fails gracefully
   instead of hanging.
2. *Lean budget*: trimmed the content the model sees (the 8-file / 1400-char caps
   above) so each call is cheaper.
3. *The real fix — a golden, repo-level cache* (`06d7c72`): the onboarding analysis
   is about the **repository**, not the customer. So I cache the report keyed by
   repo URL, and a fresh tenant reuses a prior golden analysis with **no live LLM
   call at all**. The per-customer context repo + memory are still generated live.

**Outcome:** fresh-tenant onboarding dropped to ~12s with `model=cache` and zero
throttle risk. This is the single change that made the demo dependable.

---

## Iteration 3 — Running it fully local on Ollama/Gemma

To kill the rate-limit problem entirely for testing, I wired in a local quantized
Gemma via Ollama (`c001cdb`). Two real bugs surfaced — both worth recording because
they're the kind of thing that only shows up once you actually run it:

**Bug — empty structured output.** Ollama returned empty content for structured
calls. Root cause: `format: json` with a low `num_predict` burns the entire token
budget on whitespace before emitting any JSON. **Fix:** floor `num_predict` to
**768** whenever a response schema is present
(`generators.py:203`). RCA then ran in ~95s with good quality; chat replies in ~25s.

**Bug — plain-text calls crashing.** Non-structured calls were being run through
`json.loads` and crashing on prose. **Fix:** skip structured parsing entirely when
`response_schema is None`. Obvious in hindsight; only visible by running a
plain-text path.

---

## Iteration 4 — Memory: research before I built

Before writing the memory system I deliberately researched how established agent
systems do it, rather than inventing a scheme. I looked at **Stanford Generative
Agents** (memory stream + retrieval scored by recency · importance · relevance +
reflection), **MemGPT/Letta** (memory hierarchy, self-editing, paging), **mem0**
(ADD/UPDATE/DELETE/NOOP), and **QMD** (a pluggable-backend design), plus the more
obscure **ZeroClaw** (a `Memory` trait + a `MEMORY_SNAPSHOT.md` "soul" file) and
**Hermes** (frozen snapshot + an FTS5 session DB). The design spec is committed at
`docs/superpowers/specs/2026-06-01-agentic-memory-chat-design.md`.

**Decision — a 3-tier memory, SQLite-only** (`cdb30bb`):
- **Core memory** — always injected (the "soul," a `MEMORY.md`-style snapshot).
- **Episodic / conversational** — FTS5 BM25-searchable, recalled across sessions,
  namespaced per customer.
- **Skill memory** — the self-healing skill system I'd already built, slotted in as
  the semantic tier.

Retrieval composes recency · importance · relevance (the Generative Agents recipe).
**The deliberate tradeoff:** no vector DB. At demo scale, FTS5 keyword + BM25 is
faster to operate, has zero extra infra, and is genuinely good enough — I noted
embeddings as the upgrade path rather than reaching for them prematurely.

---

## Iteration 5 — Chat that shows its work

A result-only API is unconvincing for an *agent*. I wanted the Claude-Code feel:
watch it think, see the tools fire, be able to interrupt.

**Decisions** (`bec09fd`, `56b9859`):
- **SSE, not WebSocket** — one-way server→client streaming is all chat needs;
  SSE is simpler and proxies cleanly through Vite.
- **Hand-rolled stream client** (fetch + `ReadableStream`), not the Vercel AI SDK —
  I wanted full control over the `routing / thinking / tool / reply / result` event
  frames and no dependency I'd have to fight.
- **Interrupt + queue**: per-(customer, thread) work is serialized by a lock;
  a new message can cancel the in-flight task and queue behind it.

Then made it persistent (`1acd0e8`): a `GET /chat/history` endpoint so the thread
restores on reload.

---

## Iteration 6 — The gating race (a frontend bug worth documenting)

**Symptom:** after onboarding completed and I clicked "Start chatting," the app
bounced *back* to onboarding and re-locked every console.

**Diagnosis:** the gating effect that checks "does this tenant have a context repo
yet?" was re-running on a dependency that changed mid-transition, racing against the
`onboarded()` callback that flips the gate open.

**Fix** (part of `41e6b81` / `b852477`): made the gate-check a **mount-only**
effect keyed on `customerId`, so onboarding's completion callback is the single
authority that unlocks the consoles. Lesson re-learned: a stale dev server hid the
fix for a while — I had to confirm the HMR actually applied before trusting the
result.

---

## Iteration 7 — "I can't demo the release like this" → the flagship rework

The release agent worked, but clicking **Run Release** finished everything *in a
flash*. There was nothing to watch — fatal for a demo of a "release bot."

This became the biggest single piece of work, and the clearest example of the
build→feel→fix loop.

**What I rebuilt** (`b852477`, `0877643`):
- Turned Release into a **multi-region orchestrator**: pre-deploy gate → deploy all
  regions → verify startup logs → run sanity scripts → publish a report, across
  `us-east-1 / eu-west-1 / ap-south-1`.
- **Streamed every phase over SSE** (reusing the chat streaming pattern) so the UI
  animates step-by-step: per-region spinners that resolve to ✓ / ✗ one phase at a
  time.
- **Made it context-aware**: the agent reads the onboarded context repo, so it
  deploys the *real* service with its *real* dependencies — the failing region's
  startup log references the service's actual data store, not a generic error.
- **A better report**: a `Partial — 2/3 regions healthy, failed regions rolled
  back` banner, per-region expandable logs, and a changelog.

**Then I tuned the feel twice:**
- First pass streamed correctly but still resolved all three regions at the same
  instant.
- **Final tune** (`1e11cc6`): lengthened each phase and added a 0.7s stagger so
  regions complete *one at a time* — the rollout now reads as a cascade, ~15s total
  instead of ~5s. (I caught the original "no `--reload`" gotcha here: my pacing
  edit wasn't live until I restarted uvicorn with `--reload`.)

---

## Iteration 8 — The gateway: a Telegram bot on the same brain

The last piece was meeting the agent where engineers already are — chat. I wanted a
user to connect *their own* bot and have OpsMindAI answer from it, sharing the same
memory as the console.

**The decision I researched first — transport.** Telegram bots receive messages two
ways: long-polling (`getUpdates`, outbound) or webhooks (inbound, needs a public
URL). I checked how the self-hosted agents in this space actually do it: both
**Hermes** and **OpenClaw** default to **long-polling** for local/self-hosted, and
treat webhook purely as a cloud optimization (so idle machines can sleep). Both also
flag one hard constraint: **only one active poller per bot token**. So I built
long-polling and made connecting a bot always stop any existing poller first.

**The insight that made "see sessions" almost free.** The web chat already persists
every turn to memory keyed by `(customer_id, thread_id)`. So I mapped each Telegram
chat to a thread `tg-<chat_id>` and ran it through the *same* `run_turn` pipeline
(route → agents → memory) — capturing the final reply to send back. Now Telegram
conversations land in the exact same store as the web chat, and the dashboard's
"live sessions" mirror is just a query for `tg-*` threads. The bot and the console
are one brain, one memory.

**What I built** (`gateway.py` + sidebar modal + a sessions view): connect
(validate token via `getMe`, persist, start a poller), an always-on poll loop per
tenant that resumes on startup, a "typing…" action while the agent works, and a
read-only mirror that auto-refreshes — each chat expandable to its full transcript.

**One bug worth recording:** my first `getUpdates` call collided on the name
`timeout` — Telegram wants a `timeout` query param for the long-poll hold, but I was
already using `timeout` for the HTTP client read timeout. Renaming the client one to
`client_timeout` fixed a poller that otherwise returned instantly in a hot loop.

## What's real vs mocked (current, honest)

**Real:** GitHub scan + context-repo commits, RCA reasoning, trace correlation,
3-tier memory (FTS5 BM25 + recency/importance), skill persistence & recall, run
persistence, SSE streaming for chat and release, the **Telegram gateway**
(long-polling a real bot, shared memory, live session mirror), multi-tenant
`customer_id` threading, the onboarding golden cache, local + hosted LLM providers.

**Mocked (deterministic, scenario-driven):** service logs, AWS config validation,
Jenkins deploy, sanity scripts, startup telemetry — each with
`healthy / degraded / blocked` modes.

---

## What I deliberately cut, and why

- **Real Jenkins/AWS SDK calls** — mocked per the brief; the agent *reasoning over*
  their output is the interesting part, and that's real.
- **Telegram webhook mode** — long-polling covers the self-hosted demo; webhook is
  the documented cloud path (lets idle machines sleep), not built.
- **Vector DB for memory** — FTS5 is enough at demo scale; embeddings are the
  documented upgrade path.
- **A worker queue / auth enforcement** — designed for (single-process is fine for a
  demo), `customer_id` isolates data but there's no login enforcement layer.

---

## If I kept going

- GitHub App installation tokens (the credential seam is already isolated to one
  class), so each customer gets their own repo instead of a folder in a host repo.
- Embedding-based recall once memory volume justifies it.
- A worker queue for true concurrency, with per-tenant token accounting surfaced in
  the dashboard.
- Trimming the occasional redundant tool re-invocation in the cognitive loop.

---

*This journal pairs with `IMPLEMENTATION_LOG.md` (the final-state decisions
snapshot) and the `docs/` design specs (the thinking written down before each
phase). Together they cover intent → design → build → iteration.*
