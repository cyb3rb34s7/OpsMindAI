I read the prototype before writing this: `CognitiveRunner`, the cognition schemas, the tool registry, `MemoryService`, the RCA agent, `ContextRepoGenerator`, and the CodeiQ output set. Everything below is grounded in what's actually in the repo, not just the pitch. This is long because you asked for depth; the sharpest claims are up front.

---

# 0. The five things I'd bet the company on getting right

1. **Your context repo is currently write-only, and nobody has noticed.** `RCAAgent.execute()` checks `storage/context_repos/{customer_id}` *exists*, then passes the *path string* into the prompt. The CognitiveRunner has no tool that reads context repo content. The "most important thing in the product" is decorative at runtime today. This is the single highest-leverage fix and it reframes the design: the context repo must be designed **read-side first** — what does the RCA agent need to fetch in under 2 seconds during an incident? — and the folder structure falls out of that, not the other way around.

2. **Your cognitive loop can't pass arguments to tools.** `CognitiveStep` has `selected_tool: str | None` and nothing else. Tools receive `{user_prompt, working_prompt, memory, step}` and have to guess intent. You cannot build a real RCA agent on this — "fetch logs for payment-service between 14:20 and 14:35 filtered to ERROR" is unexpressible. Every frontier model now does native function calling with typed arguments; your schema-tolerant degradation philosophy is good, but it needs to degrade from *typed tool calls*, not from no-arguments.

3. **The sidecar, as specified, is a service mesh.** "Attaches trace_id to outbound requests" means intercepting application egress, which means a transparent proxy (iptables redirection, Envoy-style) — that's Istio's job and enterprises take quarters to approve it. You should not build this. The right answer is OpenTelemetry-first (details in §4). Your actual moat is the reasoning layer, not telemetry collection — be the best *consumer* of telemetry that already exists.

4. **"Resolves most incidents before a human sees them" is a trust cliff, not a feature.** No enterprise will let you auto-remediate in year one, and the first wrong auto-action ends the account. The product that wins is *calibrated recommendation*: every RCA output carries a confidence score that is actually validated against outcomes, and autonomy is earned per-signature ("this exact failure signature has been confirmed-correct 12 times; auto-execute the runbook next time" is a customer-clicked checkbox, per signature). Design the autonomy ladder now, because it shapes the data model (you need outcome feedback on every investigation).

5. **You have no eval harness, and this product dies without one.** An RCA agent that's right 60% of the time is worse than nothing — it costs trust and trains engineers to ignore it. Before Phase 1 ships anything customer-facing, you need a golden incident dataset and a replay harness (§7.1). This is not optional infrastructure; it is the thing that lets you change prompts, models, and tools without regressing. The good news: your deterministic mock incident scenario (`trace_123`) is the seed of it.

---

# 1. Architecture critique — what's wrong, underspecified, or naive

## 1.1 Runtime layer

The LLM abstraction and fallback chains are genuinely good. The CognitiveRunner has structural problems:

- **Quadratic context growth.** Each iteration, `working_prompt` is rebuilt as JSON containing the full memory dump, and `memory.findings` appends the *entire* serialized tool result (`json.dumps(tool_result.data)`). A real log query returns 500KB. By iteration 3 you've blown the context window and your costs. You need: per-tool-result summarization or reference-passing (tool results stored by ID in a run-scoped blob store; the model sees a summary + an ID it can re-fetch slices of), and a token budgeter like the one you already built for `MemoryService.build_working_set` — that's the right pattern, applied in the wrong place only.
- **`max_iterations=4` is a demo number.** Real RCA needs 10–25 tool calls (query logs, narrow window, check graph, check recent deploys, re-query). With reference-passing and budgeting you can afford it.
- **No run persistence.** `step_log` is returned and discarded. Every run must persist its full trace (steps, tool calls, token counts, latencies, model used) — this is the raw material for evals, debugging, billing, and the "execution trace" the dashboard shows. Build it as an append-only `agent_runs` / `run_steps` table from day one.
- **No cost/latency accounting.** Per-run token and dollar tracking, per-tenant budgets, circuit breakers. You're pricing per repo + log volume; your COGS is LLM tokens. You can't price what you don't measure.
- **Failure handling is crash-or-nothing.** `raise RuntimeError("Cognitive step returned no structured output")` — one malformed step kills the run. The runner needs step-level retry (you have it at the HTTP level, not the cognitive level) and a degraded-finish path ("here's what I found before I got stuck").

## 1.2 Memory

`MemoryService` is well-built for what it is (the namespace-key discipline and the working-set budgeter are nice). Issues:

- **BM25-only recall will miss paraphrases**, which matters most for skill matching ("OOMKilled on payment-svc" vs "payment service pod memory limit exceeded"). You know this. The fix is tiered, not a wholesale swap.
- **Swallowing every exception** (`except Exception: return []`) is right for chat UX and wrong for ops: you need a metric/alert when memory is silently failing, or you'll debug "the agent forgot everything" for a week.
- **No forgetting/consolidation.** Facts accumulate forever; contradictory facts (the on-call rotation changed) both surface. You need fact supersession (new fact with same subject-key replaces old) and periodic LLM consolidation of episodic memory.

## 1.3 Context repo (current state)

- Flat files, full rewrite per run (`for old in repo_dir.glob("*.md"): old.unlink()`) — destroys any human edits and any agent-accumulated knowledge. The repo must be **merge-updated**, never regenerated.
- **All customers' context committed into one shared GitHub host repo** (`settings.github_context_repo`, per-customer folders). For a demo, fine. For production this is a compliance non-starter and a one-token-leak-away data breach: per-tenant isolation required.
- No schemas, no quality scores, no reader.

## 1.4 Multi-tenancy, auth, and the platform substrate

Underspecified to the point of absence, and it's load-bearing for Phase 3 but must be *designed* in Phase 1:

- `customer_id` is a string set by a demo animation. Good news: the namespace discipline means the tenancy seam already exists. Decide now: tenant_id is issued by auth (OIDC/SAML — enterprises will demand SSO day one), enforced at the API boundary, never trusted from payloads.
- SQLite → Postgres isn't just a migration, it's an architecture change: your ingestion pipeline is a **durable workflow problem**, not a request/response problem. Recommendation: **Temporal** — onboarding is exactly the multi-step, partially-failing, resumable, parallel-fan-out workflow Temporal exists for. Do not build this on asyncio tasks inside FastAPI.
- Webhook ingestion needs an inbox pattern: receive → persist event → ack fast → process async with retries.

## 1.5 Failure modes you haven't listed

- **Stale context is worse than no context.** The RCA agent confidently reasons from an architecture summary describing the service before last quarter's refactor. Every artifact needs freshness metadata and the reader must surface staleness to the agent.
- **Prompt injection via logs and code.** Your agents put raw log lines and repo content into prompts. A log message that says "ignore previous instructions" is a real attack on an agent with tools. Mitigations: tools are capability-scoped per agent, all ingested text is treated as data, state-changing actions require human approval.
- **Topology inference from static analysis across services is unreliable.** HTTP calls via config-driven base URLs, queue topics, gRPC service discovery — static analysis sees a string, not an edge. The fix: static gives candidate edges with low confidence; runtime traces confirm/deny; the reconciled graph carries per-edge provenance.
- **The cold-start demo problem.** Day one, a customer has zero skills, possibly no trace IDs in their logs, and a context repo with quality score 0.4. Your first-week experience — before any learning loop has fired — is what closes or loses the deal. Phase 1 must make the *no-priors* RCA path excellent.
- **CodeiQ scan scale.** 174 files → fine. A 4,000-file Java monolith → memory, time, and graph-size questions you haven't tested. Bound it, shard it, and make the pipeline tolerate a failed scan of one service without failing onboarding.

---

# 2. The context repo — full design

## 2.1 The core insight: it's two stores wearing one trenchcoat

You have two different consumers with opposite needs:

- **Humans and "compile me a context" reads** want narrative, rendered, versioned artifacts → git + markdown is perfect.
- **Agents mid-incident** want *facts* in milliseconds: "what calls `charge_card`?", "failure signatures matching this fingerprint", "owner of payment-service", "endpoints touching the `payments` entity". Grepping markdown for these is slow, lossy, and unrankable.

So: **git is the canonical store; a derived index is the query plane.**

```
                    ContextRepoWriter (only write path)
                            │ validates, scores, commits
                            ▼
              ┌─────────────────────────────┐
              │   Git repo (per tenant)      │   ← source of truth, audit trail,
              │   rendered artifacts (.md,   │     human-readable & human-editable
              │   .json, .svg) + frontmatter │
              └─────────────┬───────────────┘
                            │ post-commit indexer (deterministic, rebuildable)
                            ▼
              ┌─────────────────────────────┐
              │   Index (Postgres+pgvector)  │   ← derived, disposable, rebuilt
              │   - artifact registry        │     from git at any time
              │   - fact tables (signatures, │
              │     owners, edges, endpoints)│
              │   - embeddings + FTS         │
              │   - code graph tables        │
              └─────────────────────────────┘
                            ▲
                    ContextRepoReader (only read path)
```

Rules that keep this sane:

- **One-way derivation.** The index is always rebuildable from git. No data lives only in the index except ephemeral caches.
- **Humans can edit the git repo directly** (it lives in *their* GitHub org). A human-edited commit gets `provenance: human` which outranks agent provenance in conflicts.
- Structured JSON artifacts (signatures, graphs) are committed to git *and* loaded into typed tables. Markdown artifacts are committed and indexed (chunk → embed → FTS).

One deliberate exception: **the code graph JSON blobs (CodeiQ output) go to object storage with a pointer in git**, not into git itself. `full-graph.json` for a real monorepo is tens of MB and changes every push; it will bloat the repo into unusability.

## 2.2 Folder structure

```
context-repo/                          # one repo per tenant
  _meta/
    manifest.json                      # schema_version, tenant, services list, last_full_scan
    ingestion-ledger.jsonl             # append-only: every pipeline run, what it touched
  org/
    service-map.md                     # + .mmd source; SVG rendered by CI, not committed by agents
    topology.json                      # cross-service edges WITH per-edge provenance+confidence
    team-memory.md                     # Mindy's promoted org facts (promoted, not raw)
    conventions.md                     # "we deploy Tuesdays", "staging is flaky", tribal knowledge
  services/
    {service-name}/
      service.yaml                     # THE structured spine (schema below)
      README.md                        # generated index of this service's artifacts
      architecture/
        overview.md
        data-flow.md
        tech-stack.md
      api/
        endpoints.md                   # rendered from endpoints.json (CodeiQ) + annotations
        contracts/                     # OpenAPI/proto if discovered
      code-intelligence/
        graph.manifest.json            # pointer: S3 URI + content hash + codeiq version + stats
        entry-points.md
        critical-paths.md              # LLM-synthesized, human-confirmable
        dispatch-annotations.yaml      # manual annotations closing the dynamic-dispatch gap
      observability/
        log-schema.yaml                # inferred log format(s), field mappings → canonical schema
        log-templates.json             # mined templates (drain3) with baseline frequencies
        alerts.md                      # known alerts/monitors mapped to this service
      operations/
        runbooks/{slug}.md
        deploy.md                      # how it ships: pipeline, gates, rollback procedure
        infra.md                       # where it runs, scaling, resource limits
      incidents/
        signatures.json                # normalized failure signatures
        {YYYY-MM-DD}-{slug}.md         # post-mortems, append-only
      changes/
        deploys.jsonl                  # rolling window of deploy events (append, pruned)
      ownership/
        owners.yaml                    # team, escalation, slack channel, on-call ref
        dependencies.md
      onboarding/
        clarifications.md              # Q&A ledger: agent questions + human answers
        gaps.md                        # known unknowns, drives the quality score
        ingestion-log.md
```

## 2.3 Artifact schema: frontmatter is the contract

Every markdown artifact carries machine-readable frontmatter; every JSON/YAML artifact has a `_meta` block.

```yaml
---
artifact: architecture/overview
service: payment-service
schema_version: 1
generated_by: onboarding-agent@2.3.1        # or "human:alice@corp.com"
provenance: derived          # observed | derived | inferred | human-confirmed
confidence: 0.78
sources:                     # what this was built FROM (enables staleness math)
  - type: git
    repo: corp/payment-service
    commit: a1b2c3d
  - type: codeiq
    graph_hash: sha256:...
verified_by: null            # human confirmation pointer, or null
verified_at: null
updated_at: 2026-06-09T14:22:00Z
stale_after: 30d             # artifact-type default, overridable
tags: [payments, pci]
---
```

The **provenance ladder**: `observed` (deterministic extraction — CodeiQ, parsed config) > `human-confirmed` > `derived` (LLM synthesis from observed facts) > `inferred` (LLM guess). The RCA agent's final report must cite which provenance levels its conclusion rests on.

**`service.yaml` — the structured spine:**

```yaml
service: payment-service
schema_version: 1
repo: corp/payment-service
language: python
framework: fastapi
tier: 1
endpoints_count: 19
entities: [Payment, Charge, Refund]
depends_on:
  - service: ledger-service
    via: http
    provenance: runtime-confirmed
    confidence: 0.97
  - service: kafka:payments.events
    via: queue
    provenance: static
    confidence: 0.6
consumed_by: [checkout-service]
datastores: [postgres:payments_db, redis:payment-cache]
deploy: {pipeline: jenkins:payment-deploy, strategy: rolling, rollback: "jenkins:payment-rollback"}
telemetry:
  logs: {source: cloudwatch, group: /ecs/payment-service, format_ref: observability/log-schema.yaml}
  traces: {source: none}
ownership: {team: payments, slack: "#payments-oncall", pagerduty: P123}
quality: {score: 0.71, computed_at: 2026-06-09}
```

## 2.4 Failure signature schema

```json
{
  "signature_id": "sig_8f3a",
  "service": "payment-service",
  "fingerprint": {
    "error_class": "ConnectionPoolTimeout",
    "component": "db:payments_db",
    "log_template_ids": ["t_412", "t_87"],
    "topology_context": ["payment-service->postgres:payments_db"],
    "normalized_hash": "sha256:..."
  },
  "embedding_ref": "pgvector:sig_8f3a",
  "symptoms": ["p99 latency > 2s on POST /charge", "pool exhaustion warnings precede errors by ~90s"],
  "root_cause": "Connection leak in refund batch job under retry storm",
  "resolution": {"runbook": "operations/runbooks/db-pool-exhaustion.md", "automatable": false},
  "occurrences": [{"incident": "incidents/2026-05-12-pool-exhaustion.md", "confirmed": true}],
  "stats": {"matched": 4, "confirmed_correct": 4, "last_seen": "2026-06-01"},
  "autonomy": "recommend"        // recommend | auto-diagnose | auto-execute (customer-set)
}
```

Matching is tiered: **(1)** exact `normalized_hash` match → milliseconds, no LLM; **(2)** structured partial match (same error_class + overlapping log templates + same topology context) scored deterministically; **(3)** embedding similarity over the fingerprint text → candidates passed to the RCA agent as priors, never as conclusions.

## 2.5 Quality scoring model

```
quality(a) = w_c·completeness(a) + w_p·provenance_weight(a) + w_f·freshness(a) + w_v·verification(a)
```

- **completeness** — schema-driven: each artifact type declares required sections/fields; deterministic checker scores fill rate.
- **provenance_weight** — observed 1.0, human-confirmed 1.0, derived 0.7, inferred 0.4.
- **freshness** — decay vs `sources`: commits behind HEAD for code-derived artifacts, wall-clock vs `stale_after` otherwise.
- **verification** — has a human confirmed it, and how recently.

Service rollup is *weighted by operational importance*: `signatures.json`, `service.yaml`, `observability/log-schema.yaml`, and runbooks weigh more than `tech-stack.md`.

## 2.6 Writer and Reader interfaces

```python
class ContextRepoWriter:
    """Sole write path. Agents NEVER touch git or the index directly."""

    async def propose(self, change: ArtifactChange) -> ProposalResult:
        """Validate against artifact schema; run completeness checker; compute
        quality delta; check write policy (which agent may write which artifact
        class). Returns validation errors or a staged proposal."""

    async def commit(self, proposals: list[ProposalResult], *,
                     actor: Actor,                  # agent name+version | human identity
                     reason: CommitReason,          # onboarding|incident|deploy|clarification|discovery
                     run_id: str) -> CommitReceipt:
        """Atomic multi-artifact commit. Message format:
        '[rca-agent] incident sig_8f3a: update signatures, add post-mortem (run 7f3c)'.
        Trigger reindexes touched artifacts."""

    async def merge_update(self, artifact: ArtifactRef, patch: SectionPatch) -> ProposalResult:
        """Section-level merge for regeneratable artifacts: agent updates the
        sections it owns; human-edited sections (provenance=human) survive
        regeneration. THE fix for the current delete-and-rewrite behavior."""

class ContextRepoReader:
    # Fast typed lookups (index-backed, <50ms, no LLM):
    async def service(self, name: str) -> ServiceSpine
    async def signatures_match(self, fp: Fingerprint) -> list[SignatureMatch]
    async def graph_query(self, q: GraphQuery) -> GraphResult
    async def deploys_near(self, service: str, t: datetime, window: timedelta) -> list[DeployEvent]
    async def log_schema(self, service: str) -> LogSchema

    # Retrieval (index-backed, hybrid FTS+vector):
    async def search(self, query: str, *, services: list[str] | None = None,
                     artifact_types: list[str] | None = None, k: int = 8) -> list[Chunk]

    # Task-shaped context compilation — the workhorse:
    async def compile(self, task: TaskSpec, budget_tokens: int) -> CompiledContext
```

At runtime, agents get **three tools**: `context_lookup` (typed fast paths), `context_search` (retrieval), and the compiled context injected up front. Writes happen *after* the cognitive loop, from the agent's structured final output — the LLM never authors a git commit mid-loop.

## 2.7 Versioning strategy

- Git history is the version history; **`reason`-tagged commits** make it navigable.
- `schema_version` in `_meta/manifest.json` + per-artifact; migrations are scripts that rewrite artifacts and commit as `[migration]`.
- **Snapshot refs at incident time**: when an RCA run starts, record the context repo SHA in the run record. Post-mortems link the SHA. This gives you "what did the system believe at the time" — essential for debugging wrong RCAs and for the eval harness.

## 2.8 Tenancy and placement

Per-tenant, the repo lives **in the customer's own GitHub org** (created by your GitHub App), with your index DB holding only derived data, row-level-secured by tenant_id. This is a sales weapon: "your operational knowledge accrues in *your* repo; if you ever leave, you keep it" defuses the lock-in objection while the real lock-in (signatures + skills + calibration history) remains in the accumulated content.

---

# 3. Ingestion architecture — validate/improve

## 3.1 The connector pyramid (replacing the sidecar-centric plan)

1. **Pull connectors — 80% of GTM.** Target enterprises *already have* Datadog/CloudWatch/Splunk/Elastic. The winning move is: "connect read-only credentials, get an operational brain, change nothing." Datadog APM is a cheat code: customers who have it give you *real runtime topology and traces* via API.
2. **OTel-native intake.** Stand up an OTLP endpoint + publish an OpsMind OTel Collector distro. Customers already running OTel add one exporter block.
3. **SDK** — thin wrapper over OTel SDKs that adds OpsMind conventions.
4. **Sidecar — kill it as specified.** What survives is the collector distro above. Trace propagation *requires* code-level instrumentation or a mesh; pretending a sidecar solves it will burn a quarter. **eBPF**: don't build it, but design the OTLP intake so eBPF-sourced telemetry flows in.

## 3.2 The onboarding pipeline

Run as a **Temporal workflow** (resumable, per-service activities, partial failure tolerated). Every step writes provenance-tagged artifacts through the Writer. Topology inference outputs candidate edges with confidence, never asserted facts. The clarification agent's output is a ranked queue keyed by quality-score-gain, delivered where engineers live.

Incremental updates: GitHub webhook → event inbox → debounced per-service re-scan → `merge_update` of affected artifacts → freshness restored. Also ingest **deploy events**.

---

# 4. The log pipeline

## 4.1 Principle: query-in-place first, ingest second

Do not build a log store in Phase 1. Architecture:

```
            ┌──────────────────────────────────────────────────────┐
            │                  LogQueryService                      │
            │  one interface, provider adapters behind it           │
            │  (mirrors your LLM adapter pattern — same playbook)   │
            └──────────────────────────────────────────────────────┘
   CloudWatchAdapter   DatadogAdapter   SplunkAdapter   OTLPStoreAdapter(ClickHouse, later)
            │                │                │                │
            └────────────────┴───────┬────────┴────────────────┘
                                     ▼
                         Normalization layer → canonical LogRecord
                                     ▼
                  Investigation cache (per-incident slice) → correlation engine
```

## 4.2 Canonical record

Adopt the OpenTelemetry LogRecord data model: `timestamp, observed_timestamp, severity, body, attributes{}, resource{service.name, deployment.environment}, trace_id, span_id`. Zero invention, maximal connector compatibility.

## 4.3 Format diversity — three-stage normalization

1. **Structural parse**: JSON → direct map; logfmt → parse; raw text → stage 2.
2. **Template mining (Drain3)** — parses unstructured lines into templates+variables, *and* the template catalog with baseline frequencies becomes `observability/log-templates.json`, enabling template-frequency delta correlation.
3. **Field mapping inference**: per service, one bounded LLM pass over sampled lines proposes mappings to the canonical schema → written as `observability/log-schema.yaml` (provenance: derived, human-confirmable) → applied *deterministically* forever after. LLM infers the mapping once; the pipeline never runs an LLM per log line.

## 4.4 Correlation engine

Tiered by available signal:

- **Tier 1 — trace_id present**: group by trace, build the causal span chain, compute the failure frontier, diff against exemplar healthy trace.
- **Tier 2 — no traces (most customers)**: anchor on alert time; pull windows for alerted service + 1-hop topology neighbors; compute per-service template deltas and novel templates; order candidate origin services by (delta magnitude × topology direction × deploy recency); emit a ranked causal hypothesis set.
- **Tier 3 — cross-signal**: overlay deploy events, config changes, and infra events on the same timeline.

---

# 5. Phase 1 implementation plan

**WS-A: Runtime hardening (week 1–2)**
- A1. Native tool-calling: tools declare pydantic arg schemas; `CognitiveStep` gains `tool_args`; adapters use provider function-calling where available.
- A2. Tool-result reference passing + token budgeter; raise `max_iterations` to ~16.
- A3. Run persistence: `runs`, `run_steps`, `tool_invocations` tables (Postgres), full trace + token/cost per step.
- A4. Per-agent tool scoping (capability lists, enforced in registry).

**WS-B: Context repo v1 (week 1–3)**
- B1. Schemas: frontmatter spec, `service.yaml`, `signatures.json`, artifact-type registry with completeness checkers.
- B2. `ContextRepoWriter` (propose/commit/merge_update) + git backend.
- B3. Indexer: post-commit → Postgres (artifact registry, spine tables, chunks with pgvector embeddings + FTS).
- B4. `ContextRepoReader`: `service()`, `search()`, `compile(RCATask)`, `signatures_match()`.
- B5. Migrate OnboardingAgent to the Writer (kills the delete-and-rewrite bug).

**WS-C: Real telemetry (week 2–4)**
- C1. `LogQueryService` + CloudWatch Insights adapter + canonical LogRecord normalization.
- C2. Drain3 template mining + per-service template catalog persisted via Writer; baseline frequency job.
- C3. Correlation engine Tier 2 + Tier 3 (no-trace path first).
- C4. Deploy-event ingestion (webhook inbox → `changes/deploys.jsonl`).

**WS-D: Code graph service (week 3–4)**
- D1. Load CodeiQ JSON into Postgres edge tables (skip Neo4j; recursive CTEs or networkx in-process).
- D2. Graph query tools: `callers_of(fqn)`, `blast_radius(file|symbol)`, `path_from_endpoint(route)`, `entities_touched(change_set)`.
- D3. `dispatch-annotations.yaml` ingestion to patch the dynamic-dispatch gap.

**WS-E: RCA agent v2 (week 4–6) — the integration point**
- E1. Rebuild on compiled context + tools: `query_logs`, `correlate`, `graph_query`, `context_search`, `get_recent_deploys`. Two-phase: deterministic pre-fetch *then* cognitive loop.
- E2. Structured `RCAReport` v2: causal chain with per-link evidence refs and provenance, confidence, recommended actions, and "what I could not verify."
- E3. Post-investigation write-back: post-mortem + signature upsert + discovered-fact proposals, all through the Writer.
- E4. Outcome capture: confirm/correct/reject from a human feeding `stats.confirmed_correct`.

**WS-F: Eval harness (week 2 onward, continuous)**
- F1. Golden incident set: 5 synthetic scenarios + archetypes on a demo stack.
- F2. Replay runner: incident + frozen context-repo SHA + frozen log fixtures → RCA run → scored on root-cause accuracy, evidence quality, iteration count, cost. Run on every prompt/model/tool change.

**WS-G: Trigger plumbing (week 5–6)**
- PagerDuty webhook → event inbox → auto-investigation; results posted to a thread. Mindy delegation path updated to RCA v2.

---

# 6. What you haven't thought of

1. **The eval harness** — you cannot iterate on an RCA agent you cannot score.
2. **Confidence calibration as a product surface.** Track predicted-confidence vs confirmed-outcome per signature, per service, per agent version. This number *is* the autonomy ladder.
3. **Agent observability — you are an ops product; your agents need ops.** Instrument your own runtime with OTel (dogfooding that doubles as the best demo).
4. **Cost economics as architecture.** Per-investigation token budgets, model-tier routing, per-tenant monthly LLM budgets with graceful degradation.
5. **Security review readiness.** SOC 2 from the start (audit logs from run persistence + git history), secret/PII redaction *at ingestion*, read-only-by-default IAM cross-account roles for CloudWatch, data residency story, prompt-injection mitigations.
6. **The human correction loop as a first-class write path.** Engineers will disagree with RCAs. "You're wrong, it was the config change" must be capturable, must update the signature and post-mortem, and must show up in evals.
7. **Knowledge decay and contradiction management.** Scheduled re-verification of high-importance derived artifacts, supersession semantics for facts, and a "context repo diff" digest.
8. **The demo/sandbox estate.** A permanently running multi-service demo environment with injectable failures. It's your eval substrate, your sales demo, your onboarding playground, and your regression net.
9. **Concurrency semantics.** Two investigations on the same service, an incident during onboarding, a push mid-investigation: snapshot-SHA reads + Writer-serialized commits per service path handle it.
10. **The wedge framing for GTM.** "Operational brain for your whole org" is the vision; the Phase 1 *sale* is narrower and stronger: "connect GitHub + CloudWatch + PagerDuty; next incident, there's a draft RCA with evidence in the thread before your engineer has opened a laptop."

---

## Final verdict

The prototype's bones are better than most at this stage: the adapter layer, the schema-tolerant cognition, the namespace discipline in memory, and the working-set budgeter are patterns you should *propagate* (the LogQueryService and Reader designs above deliberately reuse them). The two structural debts are the argument-less tool loop and the write-only flat-file context repo, and both are fixable in weeks, not months. The strategic corrections are: OTel over sidecar, recommendation-with-calibration over autonomous resolution, query-in-place over log storage, and an eval harness before a third customer-facing feature. Build Phase 1 as sequenced above and the compounding loops you've designed (signatures, org memory, context self-improvement) have a substrate that's actually real.