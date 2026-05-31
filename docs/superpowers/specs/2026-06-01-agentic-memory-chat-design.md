# Design: Agentic Experience + 3-Tier Memory + Chat

Date: 2026-06-01
Status: approved (pending spec review)

## Goal
Make OpsMindAI feel like an agent you work *with*, not a dashboard you click:
a conversational home where you talk to the orchestrator and watch it think and
use tools, backed by real cross-session memory. Keep the existing consoles.

## Decisions (locked in brainstorming + research)
- **Keep the consoles.** Add a conversational **Home (chat)** as the default
  surface after login. Onboarding stays form-based but agent-feeling (live
  thinking/loading states), not chat.
- **3-tier memory** copying ZeroClaw + Hermes patterns (verified against their
  docs), with FTS5 as the backbone and a **pluggable backend** (ZeroClaw's own
  pattern): SQLite FTS5 default, **QMD a drop-in backend later**.
- **Relevance = SQLite FTS5 BM25** (zero deps, fits Groq's no-embeddings
  constraint), composited with recency + importance (Generative Agents recipe).
  sqlite-vec / QMD embeddings are a later swap behind the same interface.
- **Per-tenant isolation** by `customer_id` namespace on every memory row.
- **Telegram** wires into the same chat service later (channel-agnostic).

## Memory architecture

A `Memory` service with a pluggable backend (default `SqliteFtsBackend`):

```
store(customer_id, category, content, importance=5, meta={}) -> id
recall(customer_id, query, k=6, categories=None) -> [MemoryHit]   # BM25 ⊕ recency ⊕ importance
core(customer_id) -> str                                          # rendered always-in-context block
forget(customer_id, id); list(customer_id, category)
```

**Tiers (categories):**
1. **Core** (always-in-context, capped ~800 tokens) — curated facts about the
   customer's system + prefs. Auto-seeded from onboarding (system summary, top
   risks, key services) and updated after incidents. Rendered as a frozen
   snapshot into the orchestrator prompt each turn, and mirrored to a
   **`MEMORY.md` "soul" file in the context repo** (Hermes/ZeroClaw pattern).
2. **Conversation / Episode** (searchable) — chat turns and notable events
   (incidents, onboardings, releases) as natural-language rows in `memory_entry`,
   indexed by an FTS5 virtual table; recalled on demand by BM25 ⊕ recency ⊕
   importance, top-K injected.
3. **Skill** (self-healing) — the existing `skills` table stays canonical;
   `recall()` unions matched skills into the working set. Reflection/consolidation
   turns repeated episodes into higher-level skills.

**Lifecycle:** `recall()` before each orchestrator turn → working set =
`core + top recalled episodes/conversation + relevant skills`; **autosave** after
each turn (store conversation; store an episode if an agent ran), with hygiene
(skip synthetic/heartbeat content, dedup near-duplicates ADD/UPDATE/NOOP).

**Tables (raw sqlite, matching existing style):**
```
memory_entry(id, customer_id, category, content, importance INT,
             thread_id, created_at, last_access)
memory_fts  -- FTS5 virtual table, content='memory_entry', ranked by bm25()
```

## Chat + orchestrator

`POST /api/v1/chat {customer_id, thread_id, message}`:
1. Build working set via `Memory.recall` + `Memory.core` + `find_relevant_skills`.
2. Orchestrator classifies intent (with working set in context).
3. If an agent is needed, run it (onboarding/rca/release); capture the execution
   trace (cognitive steps + tool calls).
4. Compose assistant reply (prose + structured result for a rich card).
5. Autosave conversation + episode; update skills; (optional) consolidate.
6. Return `{reply, route, result, thinking: steps, tools: tool_results,
   memory_used}`.

"**Thinking + tools**" is the returned execution trace; the UI reveals it
(thinking → tool chips → result card). Real streaming (SSE) is a later upgrade.

## Frontend
- **Home (chat) view** = default after login: a thread (user/assistant bubbles),
  assistant turns can embed **rich result cards** (RCA report, onboarding
  summary, release gate). A **right panel** shows learned skills (and recalled
  memories). An inline **thinking/tool-use** display animates while the agent runs.
- Keep Onboarding / Context Repo / Investigation / Releases / Knowledge consoles.
- **Agentic onboarding**: agent greeting + richer live thinking/loading states.
- **Gating**: lock Investigation / Releases until a context repo exists (probe
  `/context/{customer}`); Home + Onboarding always available.
- **Transitions**: smooth section/page transitions throughout.

## Build sequence
- **M1 — Memory service**: backend `Memory` + FTS5 tables + store/recall/core;
  wire RCA/orchestrator to write episodes and recall. Testable via API.
- **M2 — Chat service**: `/chat` endpoint (conversational orchestrator + trace +
  autosave/recall + compaction).
- **M3 — Home chat UI**: thread, rich result cards, thinking/tool display, skills panel.
- **M4 — Agentic onboarding states + gating + transitions polish.**
- **Later**: QMD recall backend; Telegram channel into `/chat`; sqlite-vec hybrid.

## Out of scope
- Real auth (login stays a demo animation).
- Real-time token streaming (return-then-reveal instead).
- Un-mocking logs/AWS/Jenkins.
- QMD/embeddings on the critical path (interface-ready, not required).

## Success criteria
- You can chat on Home: "investigate trace_123" → orchestrator routes → you see
  it think + use tools → an RCA card renders inline.
- Memory persists across sessions: after onboarding + an incident, a new session
  for the same customer recalls "you onboarded Online Boutique; cartservice→redis
  is a known pattern."
- A `MEMORY.md` soul file appears in the context repo and grows with use.
- Investigation/Releases are locked until a context repo exists.
- FTS5 recall returns relevant past entries scoped per customer; QMD remains a
  drop-in backend behind the same `recall()`.
