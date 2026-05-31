# Design: Agentic Experience + High-Quality Context Repo

Date: 2026-06-01
Status: approved (pending spec review)

## Goal
Make OpsMindAI feel like an **agentic product**, not a dashboard: an onboarding
agent greets and leads the user, downstream consoles are gated until a context
repo exists, and the context repo the agent produces is genuinely rich. Keep the
demo light and reliable via bounded-real scanning + caching.

## Decisions (locked in brainstorming)
- **Bounded-real onboarding scan.** Read the file tree + README + languages, then
  the **contents of ≤12 high-signal files** (manifests, entrypoints, Dockerfiles,
  CI, top-level service dirs), each capped ~4KB. Token cost is bounded regardless
  of repo size. The existing large-repo guard still applies.
- **Demo repo = `GoogleCloudPlatform/microservices-demo`** (Online Boutique).
  Public, rich, polyglot, multi-service with a Redis-backed cart.
- **Narrative coherence.** Re-point the mocked `trace_123` logs at Online Boutique
  services: `frontend → checkoutservice → paymentservice → cartservice (redis)`.
- **Caching.** Onboarding results cached in SQLite keyed by
  `(customer_id, repo_url, context_hash)`. First run live; replays instant. A
  `force_refresh` flag (UI "Re-scan live") re-runs.
- **In-app context viewer.** `GET /api/v1/context/{customer_id}` returns artifact
  files (name + markdown). New viewer panel: file list + rendered markdown.
- **Agentic-first UX.** After login, the console opens on the onboarding agent
  greeting and leading intake. RCA / Release / Knowledge are **locked until a
  context repo exists** (show a "run onboarding first" gate).
- **Smooth transitions** across landing → login → app and between consoles.

## Backend changes
1. `tools/github/client.py` — add `fetch_file_contents(repo, paths)`; in
   `scan_repository`, select ≤12 high-signal paths and attach their (capped)
   contents to the scan result as `file_contents`.
2. `agents/onboarding/schemas.py` — richer `OnboardingReport`: add
   `components` (per-service: name, responsibility, tech, dependencies, data_store),
   `data_flows` (list), `risks` (list), keep business_context/key_decisions/
   open_questions.
3. `agents/prompts.py` — rewrite `ONBOARDING_SYSTEM_PROMPT` to demand a rich,
   sectioned analysis grounded in `file_contents`, producing the new fields.
4. `agents/onboarding/context_repo.py` — richer templated artifacts:
   `project_index.md` (architecture narrative), `service_map.md` (per-component
   table), `data_flows.md`, `tech_stack.md`, `business_context.md`,
   `decision_tree.md`, `open_questions.md`, `risks.md`, `README.md` index.
5. **Cache** — `onboarding_cache` table + check/store in the onboarding agent;
   `force_refresh` in payload bypasses.
6. `modules/context/` — router serving committed artifacts for the viewer.
7. `tools/logs/tool.py` — update `DEMO_LOGS` service names to Online Boutique.

## Frontend changes
1. `views/Onboarding.tsx` — agentic intro (agent greeting), prefilled with the
   Online Boutique repo + curated context; "Re-scan live" action.
2. New `views/ContextRepo.tsx` — file list + `react-markdown` rendering of
   `/api/v1/context/{customer}`.
3. `AppShell.tsx` — gate RCA/Release/Knowledge until context exists (probe the
   context endpoint or onboarding state); locked nav items show a hint.
4. Transitions — apply entrance animations to console section switches.
5. Add `react-markdown` dependency.

## Out of scope
- Real auth (login stays a demo animation).
- Un-mocking logs/AWS/Jenkins (reasoning over them stays real).
- Per-service deep call-graph analysis.

## Success criteria
- Onboarding the Online Boutique produces a context repo with a real architecture
  narrative, a per-service map, data flows, and risks — readable in-app and on
  GitHub.
- Second onboarding of the same repo returns instantly (cache).
- RCA/Release/Knowledge are unavailable until onboarding completes, then unlock.
- The mocked incident traces the same services the user just onboarded.
- Transitions are smooth throughout.
