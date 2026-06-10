I re-read the relevant prototype surfaces before writing this: the `ReleaseAgent` (which is currently scripted demo theater — `asyncio.sleep` pacing, fake regions, reads the onboarding cache rather than any context repo), `ContextRepo.tsx` (which is exactly the file-browser-with-markdown you say you don't want), the Mindy/org-memory iteration notes in `BUILD_JOURNAL.md`, and the Telegram integration (you have Telegram today, not Slack — that matters for Area 5 sequencing). Everything below is consistent with the first session's fixed decisions: git-canonical + derived index, Writer/Reader as sole I/O paths, run persistence, the connector pyramid, and Temporal for workflows.

---

# 0. The six things this session should change your mind about

1. **The dashboard viewer should not render the markdown files.** The git repo is the canonical, portable, human-editable representation. The dashboard should render from the **index** — the structured spine (`service.yaml`, `signatures.json`, `topology.json`, fact tables) plus narrative blocks — via `ContextRepoReader`. The moment your UI parses markdown to build components, you've built a file browser with lipstick. Render from data; embed narrative. This single decision is what makes the viewer feel like a product. (§1.2)

2. **"Premium document" is achieved by density of verifiable facts, not by prose.** LLM-generated narrative walls feel premium for thirty seconds and then feel like slop. The artifact templates below are mostly **deterministically rendered from structured data**, with small, clearly-bounded LLM-narrated sections. This also makes `merge_update` actually implementable — I specify the block-ownership mechanism session 1 hand-waved. (§1.1)

3. **The release agent should be ~80% deterministic pipeline, ~20% bounded cognition — and it must start outside the deploy path.** Blast radius is a graph query. Threshold evaluation is arithmetic. Test selection is a lookup. The LLM's job is changeset intent and risk narrative only. And a blocking gate that's wrong once gets you uninstalled: the release agent climbs the same autonomy ladder as the RCA agent — observe → advise → gate → act. Phase 1 ships observe+advise. (§3)

4. **Mindy's memory is mostly a routing problem, not a storage problem.** "Sarah is on-call Fridays" should never be a memory fact — it has an authoritative API (PagerDuty); memorizing it guarantees staleness. "When payment latency spikes, check Redis first" is a failure-signature candidate, not a chat fact. The extraction pipeline's main job is **classifying each candidate into its correct home** (signature, service artifact, org fact, or discard). Mindy becomes a conversational front door to the context repo Writer, not a separate memory silo — and cross-agent sharing then falls out for free, because everything lands behind the Reader. (§4)

5. **Slack moves to Phase 1.** Session 1's WS-G already says "results posted to a thread" — that's Slack work whether you name it or not, and the Slack thread is your cheapest outcome-capture surface (E4 depends on it). The wedge sale ("draft RCA in the thread before your engineer opens a laptop") literally describes a Slack message. Teams stays Phase 3 behind a `ChatSurface` adapter. (§5)

6. **You don't have a log-ingestion metric to bill on — session 1 deleted it.** Query-in-place means you don't ingest log volume; the customer's CloudWatch bill absorbs scan costs. Your real variable cost is LLM tokens and your real value unit is the **investigation**. Price per-service platform fee + investigation volume; meter tokens internally as COGS, never expose them as pricing. (§6.1)

---

# Area 1 — The context repo as a navigable artifact experience

## 1.1 The block-ownership mechanism (the keystone, and a gap in session 1)

Session 1 specified `merge_update(artifact, patch: SectionPatch)` — "human-edited sections survive regeneration" — without saying how sections are identified. Here's the concrete mechanism, and it's also what makes rich rendering possible.

Every rendered markdown artifact is composed of **blocks** delimited by HTML comments (invisible on GitHub, machine-parseable, survives every markdown renderer):

```markdown
<!-- omd:block id=deps owner=renderer source=service.yaml hash=sha256:3f1a -->
## Dependencies
| Service | Via | Confidence | Provenance |
|---|---|---|---|
| ledger-service | HTTP | 0.97 | runtime-confirmed |
| kafka:payments.events | queue | 0.60 | static |
<!-- /omd:block -->

<!-- omd:block id=quirks owner=agent model=claude-sonnet confidence=0.74 -->
## What's unusual about this service
Refunds are processed by a batch job, not the request path — latency
alerts on `/refund` are usually queue lag, not service failure
(confirmed: incident 2026-05-12).
<!-- /omd:block -->

<!-- omd:block id=notes owner=human author=alice@corp.com -->
## Team notes
The staging Redis is shared with order-service. Don't trust staging perf numbers.
<!-- /omd:block -->
```

Three owner classes, three regeneration rules:

| Owner | Content | Regeneration |
|---|---|---|
| `renderer` | Deterministic projection of structured data (tables, stats, diagrams) | Always regenerated from source; never LLM-touched. `hash` detects out-of-band human edits → conflict surfaced as a gap entry, never silently overwritten |
| `agent` | Bounded LLM narrative (overview prose, "what's unusual", critical-path explanation) | Regenerated when sources change; carries confidence + provenance in the block header |
| `human` | Free-form | **Never** touched by any agent. Survives every regeneration. Outranks agent blocks in conflicts |

`Writer.merge_update` operates at block granularity: parse blocks → replace only the blocks the patch owns → recommit. This kills the delete-and-rewrite bug *and* gives the indexer block-level chunks with block-level provenance for retrieval — better RAG granularity than arbitrary text chunking.

**Design principle for everything below: structured data is the source; markdown is a rendering; the dashboard is another rendering of the same source.** The two renderings never drift because both derive from the spine.

## 1.2 The dashboard viewer: render the index, not the files

The current `ContextRepo.tsx` (file list → ReactMarkdown) is the anti-pattern. Replace with three navigation modes over Reader queries:

**Mode 1 — Org home (default): service cards, sorted by operational heat.**
A grid of service cards, each card rendered from `service.yaml` + run/incident tables: name, tier badge, quality ring, sparkline of incidents (30d), last deploy + outcome, top open gap. Sort order is *not* alphabetical — it's the risk score from §6.3, because the question a user brings to this screen is "where should I look?" Search bar is omnipresent (⌘K), backed by `Reader.search()` with typed quick-results: services, signatures, post-mortems, runbooks, facts.

**Mode 2 — Service page: the README, but live.**
This is the "premium document" surface. It renders the same blocks as the committed `README.md`, but `renderer` blocks render as actual components (interactive dependency table, real chart for incident history, clickable endpoint list), `agent` blocks render as styled prose with a confidence/provenance chip, `human` blocks render with the author's avatar. Left rail = the artifact tree for that service (architecture / api / observability / operations / incidents / onboarding), but presented as named sections with status dots (fresh / stale / gap), not filenames.

**Mode 3 — Graph view: a mode, not a homepage.**
See §1.3. Entered from a card's "neighborhood" action or the org-level "topology" tab.

**Quality score surface.** Never show a naked `0.4` — a grade demoralizes; a checklist activates. Render the score as a segmented ring whose segments are the score's own components (session 1 §2.5): completeness, provenance, freshness, verification — each segment clickable to the artifacts dragging it down, with the *same* entries as `gaps.md` and the same "fix it" affordances. One data source (the gaps table), three surfaces (gaps.md, the ring, the clarification queue).

**Correction from the UI — the human write path, concretely:**
Every block has a hover affordance with two actions:

- **Edit** (on `human` and `agent` blocks): inline markdown editor → `Writer.merge_update` with `provenance: human`, committed to *their* repo. Commit author: the GitHub App, with `Co-authored-by: alice@corp.com` from the dashboard session identity — auditable without requiring per-user GitHub OAuth.
- **Dispute** (on `renderer` and `agent` blocks): "this is wrong" + a one-line reason → creates a gap entry (`type: disputed`), drops the artifact's verification component, and queues it for the clarification agent. Structured data (e.g., a wrong dependency edge) gets a structured dispute: click the edge → "this dependency doesn't exist" → edge confidence floored, marked `disputed`, surfaced to the clarification queue. Humans must be able to correct *facts*, not just prose.

Both paths flow through the Writer. The UI never touches git or the index directly — same rule as agents.

## 1.3 The service map at 4 vs 40 services

One diagram that scales from 4 to 40 services doesn't exist; design three zoom levels instead:

1. **Org overview (the committed artifact).** Domain clusters, not services: community detection on `topology.json` (Louvain over the confirmed-edge subgraph) proposes clusters; cluster names are LLM-proposed, human-confirmable (a gap entry until confirmed). Render: cluster boxes with service counts and the inter-cluster edges only. This stays readable at 40+ services and is the only level committed as `.mmd` to git — Mermaid is fine to ~15 nodes.
2. **Service neighborhood (the workhorse, dashboard-only).** 1-hop ego graph of a selected service, rendered with react-flow + ELK layout from `topology.json` via `Reader.graph_query`. Edge styling encodes session 1's provenance ladder: **solid = runtime-confirmed, dashed = static-inferred, dotted = human-asserted**, opacity = confidence. This makes the confidence model *visible*, which is both honest and a trust-builder ("it knows what it doesn't know").
3. **Incident overlay.** During/after an investigation, the neighborhood view with the causal chain highlighted and evidence counts on edges. This is the screenshot that sells the product; it's also nearly free — it's mode 2 plus a highlight set from the `RCAReport` causal chain.

Do not auto-commit SVGs from agents (session 1 already said CI renders them); the dashboard never consumes SVG at all — it consumes `topology.json`.

## 1.4 Artifact templates

**`services/{name}/README.md`** — entry point, almost entirely `renderer`-owned:

```markdown
<!-- omd:block id=header owner=renderer source=service.yaml -->
# payment-service
**Tier 1** · Python/FastAPI · owned by **#payments-oncall** · quality 0.71 ▮▮▮▮▮▮▮░░░
19 endpoints · 3 entities · 2 datastores · 4 known failure signatures
Last deploy: v2.41 (2d ago, clean) · Last incident: 2026-05-12 (pool exhaustion)
<!-- /omd:block -->

<!-- omd:block id=nav owner=renderer -->
| Section | Status | |
|---|---|---|
| [Architecture](architecture/overview.md) | fresh | how it works, data flow |
| [API](api/endpoints.md) | fresh | 19 endpoints, 2 unowned |
| [Observability](observability/log-schema.yaml) | ⚠ stale 41d | log formats, alerts |
| [Operations](operations/) | gap: no rollback runbook | deploy, runbooks, infra |
| [Incidents](incidents/) | 4 signatures, 2 post-mortems | |
<!-- /omd:block -->

<!-- omd:block id=summary owner=agent confidence=0.78 -->
## What this service does
Handles charge, refund, and payment-method CRUD for checkout. Charges are
synchronous (checkout-service → POST /charge → ledger-service); refunds are
asynchronous via a batch job reading `payments.events`. State lives in
`payments_db` (Postgres) with `payment-cache` (Redis) fronting reads.
<!-- /omd:block -->

<!-- omd:block id=risks owner=renderer source=signatures.json,gaps.json -->
## Known failure modes
1. **DB pool exhaustion** (sig_8f3a) — 4 occurrences, 4 confirmed. Runbook ✓
2. **Redis evictions under cache-stampede** (sig_2c1d) — 2 occurrences, 1 confirmed.
## Top gaps
- No rollback runbook (+0.06 quality) · Kafka edge unconfirmed (+0.03)
<!-- /omd:block -->
```

**`architecture/overview.md`** — the rule that separates useful narrative from generated filler: the agent block must answer **five operational questions**, each as its own block, each citing sources, hard length caps:

1. *What does this do, for whom?* (≤120 words, cites endpoints + callers)
2. *How does a request flow?* (`renderer` Mermaid sequence diagram from graph data + ≤80 words of `agent` annotation)
3. *Where does state live, and what touches it?* (`renderer` table from `service.yaml` + entity graph)
4. *What breaks it?* (`renderer`: signatures + their topology context)
5. *What's unusual here?* (`agent`, sourced **only** from observed facts, clarification answers, and incident history — this is the highest-value section and the easiest to ruin with invention; provenance `inferred` content is banned from it)

Anything the agent can't answer becomes a visible "unverified" placeholder that doubles as a gap entry. An honest hole reads as rigor; confident filler reads as slop.

**`incidents/{date}-{slug}.md`** — post-mortem with an explicit agent/human contract, enforced by frontmatter `status: draft | confirmed | disputed`:

- Agent-owned blocks: header (links to signature, RCA run ID, context-repo SHA at investigation time), evidence timeline (each entry cites a tool invocation from run persistence — log query, graph lookup, deploy event), causal chain with per-link provenance, **"what I could not verify"** (mandatory, never empty — forced honesty), proposed actions.
- Human-required blocks, rendered as visible placeholders: *Confirmation* (was the root cause correct — this **is** the E4 outcome-capture write path; confirming here updates `signatures.json` `stats.confirmed_correct`), *Contributing factors*, *Action items with owners*.
- A post-mortem in `draft` for >7 days becomes a gap entry and a digest line (§6.3). Unconfirmed post-mortems are your calibration debt; make them nag.

**`onboarding/gaps.md`** — rendered from a structured `gaps.json` (the markdown is a view; the queue, the quality ring, and the digest all read the same data):

```json
{"gap_id": "g_017", "service": "payment-service", "type": "missing_artifact",
 "artifact": "operations/runbooks/rollback.md",
 "question": "How do you roll back payment-service? (Jenkins job? helm rollback?)",
 "quality_gain": 0.06, "consumer": "release-agent",
 "answer_mode": "freetext",          // freetext | confirm | choice | connect:cloudwatch
 "status": "open", "created": "2026-06-02"}
```

Rendered as a ranked checklist: question, *why it matters* ("the release agent can't recommend rollback steps without this"), the quality gain, and a one-click answer affordance. Sorting is `quality_gain × consumer_criticality`.

## 1.5 The artifact generation UX (onboarding live view)

Drive it entirely from infrastructure that already exists in the plan — no new state machine:

- The Temporal onboarding workflow's activities emit lifecycle events (`artifact_planned → drafting → validating → committed(quality_delta) | failed`) onto a per-run SSE channel; this is the same event stream that feeds `_meta/ingestion-ledger.jsonl`.
- The UI renders the repo tree filling in: planned artifacts as ghost cards; the in-flight artifact shows a **live preview pane** streaming the draft (stream the LLM tokens for `agent` blocks; `renderer` blocks just appear — they're instant, which itself communicates "this part is computed, not guessed"); committed artifacts flip to solid with their quality contribution animating into the org score.
- A persistent header counter: "**Learned so far:** 4 services · 61 endpoints · 9 cross-service edges (6 confirmed) · 2 questions for you." Facts, not progress percentage. Watching the counter climb *is* the "watching it build knowledge" feeling.
- Synthesis order is part of the UX: **deepest-first, not breadth-first** — fully synthesize the most operationally important service (largest + most recently deployed) before touching the rest, so there's something genuinely impressive to read at minute 5 while the remaining 39 services fill in behind it.

**Phase placement (Area 1).** The block mechanism is not UI work — it's the concrete spec for **B2's `merge_update`** and must land in week 1–3 with WS-B. New workstream **WS-J (dashboard v1, weeks 4–7)**: org home + service page + gap checklist + dispute/edit write path + onboarding live view. The neighborhood graph view ships in WS-J; the incident overlay rides WS-E's report schema. **Deferred:** org-level cluster detection (hand-curated clusters until >12 services), SVG rendering CI, post-mortem nag automation (digest line first, automation later).

---

# Area 2 — The onboarding connect flow

## 2.1 Pushback first: redefine "first value"

"5 minutes to first value" is right as a slogan and wrong as a spec. You cannot have working RCA in 5 minutes (no log source validated, no baselines mined). Define a **value ladder** and design each rung:

- **T+5 min:** the system demonstrably *understands their code* — service map, first service deep-dive readable.
- **T+40 min:** full scan complete, quality checklist populated, clarification queue seeded.
- **T+1 day:** log schema inferred, template baselines mined, **retro-RCA delivered** (below).
- **First incident:** draft RCA in the thread.

## 2.2 The connect flow, screen by screen

**Screen 1 — Sign in.** OIDC/SSO (session 1: tenant_id issued by auth, day one). Create org → tenant provisioned.

**Screen 2 — Connect GitHub.** GitHub App install (not OAuth tokens — installation tokens, fine-grained, revocable, org-visible). Repo picker with a recommendation: "select the repos that run in production." Two permission asks, explained inline: read on selected repos; **create one repo** (`opsmind-context`) in their org — with the sales line from session 1 rendered as UI copy: *"Your operational knowledge accrues in your repo. Leave anytime; keep everything."* If they decline repo creation: fall back to OpsMind-hosted with one-click export, and a gap entry nudging migration. Error states: app installed but zero repos granted (explain org-approval flows — enterprises often require admin approval; show a "waiting for admin" state with a copyable justification message for their admin, because *this* is where enterprise onboarding actually stalls, and pretending it won't happen guarantees a silent drop-off).

**Screen 3 — Confirm services.** The scanner proposes repo→service mappings (monorepo detection from CodeiQ's service segmentation). The user confirms/renames/merges. **This is the first clarification interaction, done inline** — it's the highest-leverage question in the whole queue (everything keys on service identity), it takes 30 seconds, and doing it here teaches the user that the system asks good questions.

**Screen 4 — Connect telemetry (skippable, but framed as the unlock).**
- **Datadog:** API + App key, scoped read-only; validate immediately with a live call; show what was found ("3 monitored services match your repos") before the user leaves the screen.
- **CloudWatch:** CloudFormation quick-create link provisioning the read-only cross-account role (`logs:StartQuery`, `logs:GetQueryResults`, `logs:Describe*` only — the template is itself a trust artifact, link to it in the UI). Validate with a `DescribeLogGroups` and show matched log groups per service.
- **Skip:** allowed, with the consequence stated as a capability, not a scold: "OpsMind will understand your architecture but can't investigate incidents until a log source is connected." Becomes the top gap entry.

**Screen 5 — PagerDuty + Slack (optional, 30 seconds each).** PagerDuty read-only API key + webhook; Slack app install (§5). Both skippable, both become gap entries with stated quality/capability gains.

**Screen 6 — The build.** The live view from §1.5. The user can leave; completion notifies via email/Slack.

**Minimum viable connection for working RCA:** GitHub + one log source + an incident trigger (PagerDuty *or* manual "investigate" button). Everything else is enrichment. The flow should make exactly this path frictionless and everything else deferrable.

## 2.3 The completion moment: "What OpsMind learned"

When the scan finishes, do not show a dashboard. Show a single generated summary screen:

- The counters (services, endpoints, edges + confirmed fraction, entities).
- **Three concrete findings** — selected from `observed`-provenance facts only (e.g., "checkout-service calls payment-service synchronously on the hot path; a payment-service slowdown is a checkout outage"). Never `inferred` content here: a wrong "insight" in minute 5 costs more trust than ten right ones earn. If nothing observed clears the interestingness bar, show two findings, not a stretched third.
- The coverage checklist (not "quality: 0.4"): **Code ✓ · Logs ✓ · Deploys ✗ · Incidents history ✗ · Tribal knowledge 0/5 questions** — each ✗ with its one-click connect/answer action and its stated gain. Framing rule: the score is presented as *how much of your org's knowledge has been captured so far* (a progress frame, where 0.4 on day one is expected and climbing), never as a grade on them or on us.
- One CTA: "Ask Mindy anything about your architecture" — chat against the day-one repo is genuinely impressive (it answers from code-derived facts) and it's available *before* any incident exists.

## 2.4 Cold start week one: the retro-RCA

The strongest cold-start move available, and it's cheap given WS-C/WS-E: if PagerDuty is connected, pull the **most recent resolved high-severity incident**, replay it — alert time anchors the Tier 2 correlation window, logs are queried in place (they still exist; retention windows make day-1 the best time), deploys overlaid — and deliver a draft RCA for an incident their team already solved: *"Here's our analysis of last Tuesday's checkout outage. Compare it to what your team concluded — then confirm or correct it."*

This does four jobs at once: demonstrates the core loop before any new incident occurs; invites a zero-risk correction interaction (they already know the answer — teaching them the confirm/correct flow); seeds the first failure signature; and produces the first calibration data point. Run it automatically on day 1–2 and deliver via the digest channel. If no PagerDuty: offer manual retro-RCA ("paste a timeframe and a service").

## 2.5 Clarification UX: budgeted, justified, mostly multiple-choice

- **Budget:** max 5 questions in week one, max 10 open ever. The queue is ranked by `quality_gain × consumer_criticality`; everything below the cut stays in `gaps.md` (visible if sought, never pushed). Unanswered questions decay in rank rather than re-nagging.
- **Format contract.** Every question states *what it unlocks*. Prefer confirmations over open questions:
  - Good: *"CodeiQ found payment-service publishing to `payments.events` but no consumer in your repos. Does anything consume this topic? [No consumer] [External system] [It's: ___]"* — 5 seconds, closes a low-confidence edge.
  - Bad: *"Please describe your deployment process."* — homework. Decompose into: "We see Jenkins config in payment-service. Is Jenkins your deploy path for all services? [Y/n/some]".
- **Delivery:** dashboard queue is canonical; Slack delivery (once connected) is a **weekly batched digest section**, never one-DM-per-question. Exception: a clarification *during an active investigation* ("is `payments_db` shared with refund-worker? It changes my hypothesis") may post into the incident thread — contextual questions get answered at 10× the rate of queued ones, and it shows the agent thinking.

## 2.6 Incremental onboarding

Each later connection is a Temporal workflow re-deriving only affected artifacts through `merge_update`:

| Connect later | Re-derived | Quality effect |
|---|---|---|
| CloudWatch/Datadog | `observability/*` per matched service; template baselines mined; topology edges runtime-confirmed (static `0.6` edges promoted) | freshness + provenance components jump; visible as "edges confirmed: 6 → 14" |
| PagerDuty | `incidents/` seeded from history; retro-RCA unlocked; alert→service mapping | verification + signature seeding |
| Slack | notification routing live; Mindy fact intake begins | gaps close via conversation |
| New repos | standard onboarding scoped to new services; org topology re-clustered | completeness |

Re-synthesis triggers (uniform rule): connector added · source webhook event (debounced, session 1 §3.2) · staleness clock breach · human dispute. Every quality recompute appends to the ledger, so the digest can say "quality 0.41 → 0.58 this week (CloudWatch connected)" — progress made visible is what gets the *second* connector connected.

**Phase placement (Area 2).** Connect flow + completion screen + clarification queue = **WS-I extension of WS-B/WS-J, weeks 3–6**. Retro-RCA = one extra trigger path on WS-E + WS-G (week 6, cheap, high yield). **Deferred:** Datadog adapter if CloudWatch ships first (pick per design-partner reality), org-admin-approval automation, self-serve repo export.

---

# Area 3 — The release agent

## 3.1 What survives from the prototype: almost nothing, deliberately

The current `ReleaseAgent` is a deploy *executor* with theatrical pacing — it pretends to deploy to three regions and invents log lines. The real product is a deploy **validator and observer**: customers already have deploy pipelines; the agent that tries to *be* the pipeline competes with Jenkins/ArgoCD and loses. The agent that *watches* the pipeline and knows the codebase competes with nothing. Keep the phase structure (pre-deploy → deploy → verify → report) as report sections; discard the execution fiction, including multi-region orchestration.

## 3.2 The autonomy ladder (decide this first; it shapes everything)

1. **Observe** — annotate every deploy event with changeset analysis + blast radius; write to `changes/deploys.jsonl`; post a report. Cannot block anything. *Phase 1.*
2. **Advise** — report includes a risk level and gate recommendation; monitoring window runs; breaches notify humans with evidence. *Phase 1.*
3. **Gate** — registered as a GitHub commit status / Jenkins gate that can block, **per-service opt-in**, only after the advisory mode's precision is demonstrated (the deploy ledger gives you the receipts: "47 deploys observed, 3 flagged, all 3 confirmed problematic" — calibration as the upsell, same mechanism as RCA signature autonomy). *Phase 2.*
4. **Act** — auto-rollback on breach, per-service + per-condition earned. *Phase 3+.*

The reports are identical at every rung; only enforcement changes. Trust is earned on receipts the system was generating all along.

## 3.3 Architecture: a five-stage pipeline, one cognitive step

Trigger: deploy event from the WS-C4 webhook inbox (GitHub `deployment`/push-to-main, Jenkins notifier, or manual). Identity: `(service, sha/version, environment)`. The whole run is a **Temporal workflow** — stage 5 is a durable multi-minute timer problem, exactly what session 1 said not to build on asyncio.

**Stage 1 — Changeset analysis (deterministic).** GitHub compare API → changed files → changed symbols (CodeiQ file→symbol map). Classify each change: `code | config | migration | dependency | infra | docs`. Classification drives risk floors: a migration file or a dependency major-bump sets `risk ≥ medium` regardless of blast radius — these are exactly the changes static call graphs can't see, so the rule layer covers the graph's blind spots.

**Stage 2 — Blast radius (deterministic, the WS-D query pattern).**

```
blast_radius(change_set):
  changed_symbols = symbols(changed_files)
  intra = reverse_reachable(changed_symbols, edge_types=[calls, imports],
                            depth ≤ 6) ∩ entry_points        # endpoints, consumers, jobs
  entities = entities_touched(changed_symbols)                # CodeiQ entity map
  cross = { (svc, edge) ∈ topology.json
            | svc consumes an endpoint ∈ intra OR shares datastore ∈ entities }
  rank by: directly-changed entry point > intra-service caller
           > cross-service consumer > shared-datastore neighbor
  confidence(path) = min(edge confidence along path)          # propagate provenance
```

Postgres recursive CTE over the WS-D edge tables; depth-capped; under 200ms for a CodeiQ-scale graph. Output is ranked entry points with confidence and the path as evidence. The `dispatch-annotations.yaml` patches (D3) apply here — a dynamic-dispatch hole in the graph is a silent blast-radius miss, which is why D3 matters more for the release agent than for RCA. Cross-service blast radius via shared datastores is the sleeper feature: "this migration touches `payments_db`, which refund-worker also reads" is the class of incident that takes humans hours to connect.

**Stage 3 — Risk assessment (the single cognitive step).** One bounded LLM call (no loop, no tools — everything is pre-fetched): input = changeset classification + ranked blast radius + `service.yaml` + signatures whose `topology_context` intersects the blast radius + recent deploy outcomes + `operations/deploy.md`. Output (structured, schema-enforced):

```python
class RiskAssessment(BaseModel):
    intent_summary: str                    # "Adds retry logic to charge path; bumps psycopg 2→3"
    risk: Literal["low", "medium", "high"]
    risk_factors: list[RiskFactor]         # each: description, evidence_refs, source(rule|graph|llm)
    signature_warnings: list[str]          # "sig_8f3a (pool exhaustion) touches this component;
                                           #  psycopg bump changes pool behavior"
    unverifiable: list[str]                # the mandatory honesty section, as in RCA reports
```

Deterministic rule-floors are merged in after the LLM (the model can raise risk, never lower it below a rule floor). The `signature_warnings` line is where the context repo flywheel becomes visible in the release surface: past incidents directly inform future deploys.

**Stage 4 — Validation plan (deterministic).** From `operations/release-policy.yaml` (below) + the risk assessment: tests to run (Phase 1: *recommend* tests selected by path-mapping heuristics — `tests/` files importing changed modules; a maintained test-mapping artifact is Phase 2; *executing* tests requires CI integration, deferred), metrics to watch (scoped to blast-radius endpoints), gate conditions instantiated with current baselines.

**Stage 5 — Monitoring window (deterministic loop, durable).** Default 30 min (per-service in policy). Every 2 min, via `LogQueryService` + the C2 template catalog, evaluate per condition → `pass | warn | breach`. **All thresholds are deltas against the pre-deploy baseline, never absolutes** — absolute thresholds are unconfigurable across customers and rot instantly; the baseline window (same metrics, 1h pre-deploy + same-hour-last-week where available) makes defaults work out of the box:

```yaml
# operations/release-policy.yaml   (new artifact type — register in B1)
service: payment-service
schema_version: 1
watch_window: 30m
conditions:
  - metric: error_rate            # from log severity counts, scoped to blast-radius endpoints
    breach: "+200% vs baseline for 3m"
    warn:   "+50% vs baseline"
  - metric: novel_log_templates   # drain3 templates never seen pre-deploy
    breach: ">= 3 distinct ERROR-severity novel templates"
  - metric: signature_match       # any Tier-1/Tier-2 signature match in window
    breach: any                   # this one condition wires the whole signature corpus into deploys
recommended_tests: {mode: heuristic}        # heuristic | mapping (phase 2)
autonomy: advise                            # observe | advise | gate | act  (customer-set)
```

Defaults are generated at onboarding from observed baselines; **evolution paths:** every monitored deploy updates baselines (cheap, automatic); post-incident, the RCA write-back may *propose* a policy tightening through `Writer.propose` (human-confirmed — policy is load-bearing config, agents never silently edit it); humans edit the YAML directly (it's in their repo).

**On breach:** the release workflow does **not** investigate — it triggers an RCA run with a deploy-context prior (`{deploy_event, breached_conditions, blast_radius}`), which enters the WS-E pipeline as a Tier-3 correlation anchor ("symptoms began 6 min post-deploy of X; changed components: …"). This is the highest-prior-quality RCA trigger the system will ever get — deploy-caused incidents become near-instant diagnoses. The release thread (Slack/dashboard) updates with the breach and links the investigation. Clean window → "all clear" appended to the report and the deploy ledger entry marked `outcome: clean`.

## 3.4 What it writes (all through the Writer)

- `changes/deploys.jsonl` — the event, enriched: risk level, blast radius summary, conditions evaluated, outcome (`clean | warned | breached → incident ref`). This ledger is simultaneously the RCA agent's `deploys_near()` source, the gate-mode calibration evidence, and a digest input.
- `changes/releases/{date}-{service}-{version}.md` — the rendered report (block-structured per §1.1; monitoring outcome appended to the same artifact by a later `merge_update` — one deploy, one artifact, full story).
- `operations/release-policy.yaml` — proposals only, human-confirmed.
- Baseline updates to `observability/log-templates.json` stats.

**Phase placement (Area 3).** New **WS-H, weeks 5–7**, gated on WS-C (LogQueryService, templates, deploy inbox) and WS-D (graph tables): Stage 1–4 + report + Slack/dashboard posting = the minimum viable release agent (observe+advise); Stage 5 with the three default conditions follows immediately (it's a Temporal timer + queries you already have). **Deferred:** gate mode (Phase 2, per-service opt-in with calibration receipts), test *execution* (Phase 2, CI integration), test-mapping artifact (Phase 2), auto-rollback (Phase 3), multi-region anything (cut entirely).

---

# Area 4 — Mindy's memory

## 4.1 The routing principle (the design's spine)

Each of your four example categories has a *different correct home*, and two of them aren't memory:

| Category | Example | Correct home |
|---|---|---|
| Live-system facts | "Sarah is on-call Fridays" | **Not memory.** PagerDuty API at question time. Memorizing API-answerable facts guarantees confident staleness — the worst failure mode session 1 named |
| Structural facts | "payment- and order-service share a Redis cluster" | `service.yaml` / `topology.json` — it's a topology edge; Mindy's extraction is just another provenance source (`human-asserted`, conf 0.9) |
| Incident patterns | "latency spike → check Redis pool first" | `signatures.json` — a signature candidate with `provenance: human-asserted`, entering the same matching/calibration machinery as learned signatures |
| Conventions/process/tribal | "deploys at 6 PM IST", "never deploy Mondays", "staging perf numbers are meaningless" | **Org facts** — the only category that is genuinely Mindy's memory |

So the extraction pipeline's primary output is a **routing decision**, and Mindy becomes a conversational intake for the *whole* context repo. Cross-agent sharing then requires zero new infrastructure: facts land behind the Reader like everything else, and the RCA agent sees "never deploy Mondays" through the same `compile()` it already calls. No separate memory service to keep consistent.

## 4.2 Extraction

Run async after each Mindy conversation turn-batch (never inline — latency). A single bounded extraction pass over the recent exchange emits candidates:

```json
{"candidate_id": "f_c_312",
 "category": "convention | structural | signature | live_system | personal | noise",
 "subject": {"type": "service", "ref": "payment-service"},
 "predicate": "deploy_window",
 "value": "Tue/Thu 18:00 IST only",
 "statement": "payment-service deploys only Tuesdays and Thursdays at 6 PM IST",
 "source": {"surface": "slack", "permalink": "...", "channel": "#payments-oncall",
            "speaker": "alice", "ts": "..."},
 "scope": "channel:payments-oncall",
 "confidence": 0.7,
 "directed_at_bot": false}
```

**What makes a fact extractable (the prompt contract):** declarative, durable (would still be true next month), operational (an agent could act on it), attributable, and *not* answerable by a connected API. Hedged speculation ("I think maybe the cache is weird?") → noise. Questions, complaints, and one-off status updates → noise. **`live_system` and `personal` categories are extracted only to be dropped** — classifying-then-discarding beats hoping the model won't extract them, and the denylist is explicit: anything about individuals beyond operational role/ownership/expertise (no performance, availability habits, sentiment) is discarded at extraction, before storage. Routing: `structural` → dispute/confirm flow on the relevant artifact (it may contradict the graph — that's a clarification, not a silent write); `signature` → signature-candidate queue; `convention` → the org-fact lifecycle below.

## 4.3 Storage, supersession, promotion, decay

**Storage:** `org/facts.yaml` is the canonical structured store (git, human-editable, block-free since it's pure data); `org/team-memory.md` is a rendered view of *promoted* facts grouped by subject (renderer-owned blocks); the indexer loads facts into an `org_facts` table with embeddings. Per-service facts also surface on the service page (§1.2) — a fact about payment-service belongs where payment-service is read.

**Lifecycle:** `candidate → promoted → superseded | expired | retracted`. Promotion requires one of: **(a)** explicitly directed at the bot ("Mindy, remember: …") → instant, `provenance: human`; **(b)** same `(subject, predicate)` extracted from ≥2 distinct conversations/speakers → auto-promote at `derived` provenance; **(c)** single extraction → sits as candidate; if an agent would have *used* it (it matched a compile query), Mindy asks a one-tap confirmation in context ("You mentioned payment-service only deploys Tue/Thu — should I treat that as a rule?"). Confirmation-on-first-use beats both auto-promotion (pollutes) and confirm-everything (nags): the facts that matter get confirmed exactly when they matter.

**Supersession:** same `(subject, predicate)`, new value → newer supersedes *at promotion time*, with the old fact kept as `superseded_by` lineage (git history is the audit). Provenance asymmetry: `human`-provenance facts are only superseded by human statements; a derived extraction contradicting a human fact becomes a **surfaced conflict** (one-tap question), never a silent winner. Two same-provenance contradictions within a short window → surface to the channel they came from: "I've heard both X and Y about deploy windows — which is right?" (This is the session-1 contradiction-management gap, closed: supersession for the clear case, surfacing for the ambiguous one.)

**Decay by class:** `convention` facts get `stale_after: 180d` → on breach, not deletion but a re-verification entry in the clarification queue ("still true that deploys are Tue/Thu only?"); facts that an agent *used* recently get their clock refreshed (use is evidence of currency); `signature`-routed stats decay exactly as session 1's signature stats already do. Retraction: "Mindy, forget that" → `retracted`, removed from views, lineage kept.

## 4.4 Injection at runtime

Facts enter agent context exclusively through `Reader.compile(task, budget)` — one new ranked source inside the existing budgeter, with a facts sub-budget (~10 facts / ~600 tokens):

```
score(fact) = relevance(embedding, task)            × subject_match_boost
            × provenance_weight (human 1.0 / derived 0.7)
            × freshness × scope_visibility(agent, requester)
```

`subject_match_boost`: facts whose subject is a service/team in the task's scope rank far above merely-semantically-similar facts — for RCA on payment-service, *every* promoted payment-service fact should clear the bar before any general fact does. Mindy's own chat additionally gets conversational recall (the existing BM25 path) over candidates as well as promoted facts; **other agents see promoted facts only** — the promotion gate is precisely what makes a chat-extracted claim safe for an autonomous agent to act on.

## 4.5 Privacy and scoping

- Facts carry `scope` from their source: `org` (public channel / dashboard) or `channel:{id}` (private channel / DM). Channel-scoped facts are visible only in interactions whose audience is that channel's membership (Slack conversation member check at compile time, cached). Promotion to `org` scope requires the human confirmation tap — a human, not a heuristic, decides a private remark becomes org knowledge.
- Agents acting *autonomously* (RCA from a PagerDuty trigger, release agent) compile at `org` scope only — an unattended investigation must never leak a private-channel fact into a report posted publicly. The capability-scoping mechanism from session 1 (A4) carries this: scope is part of the agent's capability set.
- The personal-info denylist from §4.2 applies at extraction; nothing to scope because nothing is stored.

**Phase placement (Area 4).** Fact schema + `org_facts` table + Reader integration = thin additions to **WS-B (B1/B3/B4)**. Extraction pipeline + lifecycle = **WS-I week 6–7** (it needs Slack as the intake surface to be worth anything). Minimum viable: extraction with routing, instant-promotion via "remember that", facts in `compile()`, supersession rule. **Deferred:** confirmation-on-first-use plumbing (start with the cruder ≥2-extractions rule), decay re-verification (the clock can exist before the nag does), structural-fact dispute routing (route to gaps queue manually-ish at first).

---

# Area 5 — Slack and Teams

## 5.1 Architecture: one multi-tenant app, inbox-first

**One Slack app, multi-tenant**, installed per workspace via OAuth v2. Per-customer apps don't scale, can't be directory-listed, and make token rotation a support nightmare. Mapping: `team_id` (and `enterprise_id` for Enterprise Grid — one OpsMind tenant ↔ many workspaces, supported in the mapping table from day one even if untested) → `tenant_id`. Installation tokens encrypted at rest; signature verification on every event.

Event handling reuses the session-1 inbox pattern verbatim: Events API → verify → persist to event inbox → **ack < 3s** (Slack's hard deadline; miss it and Slack retries, miss thrice and events get throttled) → process async. The Telegram passthrough in the prototype gets retired into the same abstraction:

```python
class ChatSurface(Protocol):       # the LLM-adapter playbook, third application
    async def post(self, channel, blocks) -> MessageRef
    async def update(self, ref, blocks) -> None
    async def thread_reply(self, ref, blocks) -> MessageRef
    async def open_modal(self, trigger, schema) -> None      # capability-flagged
SlackSurface(ChatSurface)   # Phase 1
TeamsSurface(ChatSurface)   # Phase 3
TelegramSurface(ChatSurface)  # wraps the existing stub
```

## 5.2 Interaction model

- `@opsmind <natural language>` and DMs route to the **Mindy orchestrator** — the existing classification/delegation path, unchanged; Slack is a new surface on the same brain (the prototype already proved this pattern with Telegram).
- Structured fast paths as Block Kit shortcuts and a `/opsmind` command: `investigate <service> <symptom>`, `status <service>`, `explain <service>`, `digest`. These bypass classification — deterministic routing for unambiguous intents.
- **Ambiguity handling differs from web by policy:** in Slack, at most **one** clarifying question, asked with buttons ("Which service? [payment] [checkout] [ledger]"); if still ambiguous, proceed with the most likely reading and *state the assumption* in the skeleton message ("Investigating payment-service — say 'wrong service' to redirect"). Slack is interrupt-driven; a Socratic back-and-forth that's fine in the web console is hostile in a channel.

## 5.3 Streaming an RCA into a thread

Token-streaming is wrong for Slack (edit-rate limits, no partial-markdown rendering, notification spam). The right pattern is **skeleton → phase updates → milestone replies → final card**:

1. **T+0 — skeleton (parent message, posted instantly):** header ("🔎 Investigating: payment-service latency · trigger: PagerDuty #4521"), a phase checklist in a context block (`▸ loading context ▸ querying logs ▸ correlating ▸ hypothesis`), and a "watch live" deep link into the dashboard run view (the full-fidelity stream lives there; Slack gets the digest of it).
2. **During — `chat.update` on the parent** as phases complete, throttled to ≥2s between edits (Slack tolerates ~1 update/sec/channel; batch beneath that). The parent is always a current, glanceable status — never a wall.
3. **Milestone findings as thread replies**, one per finding, so each is individually permalink-able (matters later: corrections and post-mortems cite Slack permalinks): "📌 14:21:32 — error rate on POST /charge +1,800% (vs 14:10 baseline)"; "📌 Deploy v2.41 to payment-service completed 14:15 — 6 min before onset".
4. **Final — parent becomes the report card:** root cause (one sentence), confidence with calibration context ("0.82 — this signature has been confirmed 4/4 times"), top-3 evidence lines, recommended action, and the action row: **[✓ Confirm] [✗ Wrong…] [Open full report] [View runbook]**. Detail lives in the dashboard and the post-mortem artifact; Slack's 3,000-chars-per-section limit is a feature here — it forces the summary discipline the report needed anyway.

## 5.4 Notification routing

Routing lives in the context repo, where ownership already lives — `ownership/owners.yaml` gains `notify:` (channel, severity floor, quiet hours policy) per service, plus an org default channel set during Slack connect. Resolution: service channel → owning-team channel → org default. PagerDuty flow: webhook → inbox → auto-investigation (WS-G) → post into the mapped channel, **threading under the PagerDuty bot's own message when findable** (search recent channel history for the incident number; fall back to a new message linking the incident) — joining the conversation where responders already are beats starting a parallel one. Defaults that respect attention: auto-post for high-severity only (floor configurable per channel), everything else dashboard-only; **never DM uninvited**; investigation results are channel-things.

## 5.5 Mindy learning from Slack — scope and privacy

Default scope, stated in the install screen in plain language: Mindy learns only from **(a)** channels she's been invited to, **(b)** messages that mention her, **(c)** threads she's participating in. No history backfill by default. This is simultaneously the defensible privacy stance, the Slack-API reality (bots read only member channels), and the right product shape — inviting Mindy to `#payments-oncall` is the team *choosing* to teach her. One opt-in extension, offered when an incident channel is detected: per-channel backfill of the last 90 days into the extraction pipeline (incident channels are where the signature-grade tribal knowledge fossilizes). Everything extracted follows §4's routing, scoping, and denylist.

## 5.6 Correction flow

The buttons on the final card are E4's outcome capture wearing its production UI:

- **[✓ Confirm]** → one tap → `stats.confirmed_correct` increments, post-mortem `status: confirmed`, calibration point logged. Make this genuinely one tap; confirmation volume is the fuel for the entire autonomy ladder and every tap of friction halves it.
- **[✗ Wrong…]** → modal (or plain thread reply — both parsed): what was the actual cause (free text) + optional evidence link → flows through the Writer: signature stats corrected, post-mortem flipped to `disputed` with the human account appended as a human-owned block, a correction entry queued for the next eval-set review (session 1 §6.6's correction loop, now with a surface).
- **Unprompted replies in the thread** ("nah, this was the config change from yesterday") run through a lightweight outcome classifier; on detected disagreement Mindy responds with the structured prompt ("Want me to record that as the correction? [Yes] [No]") — never silently ingesting a hot take as ground truth, never ignoring it either.

## 5.7 Teams

Same `ChatSurface` patterns (skeleton/update/thread/card all map: `updateActivity`, reply chains, Adaptive Cards with `Action.Execute`), genuinely different plumbing: Azure Bot Service registration, admin-consent flow (real enterprise friction — a sales-motion problem more than an engineering one), proactive messages requiring stored conversation references, and a separate app-manifest/store submission. Verdict: the abstraction is designed now (it's one Protocol), the Teams adapter is built **Phase 3 when a paying design partner demands it**, not speculatively.

**Phase placement (Area 5).** **WS-I (Slack core), weeks 4–7, promoted into Phase 1**: install flow + tenant mapping + inbox (wk 4–5); RCA thread streaming + routing + confirm/correct (wk 5–6, lands with WS-E/WS-G — *this is the WS-G deliverable, made concrete*); @mention → Mindy + fact extraction intake (wk 6–7). **Deferred:** App Directory listing (needs review lead time — start the paperwork early, ship via direct install URL), Home tab, slash-command autocomplete polish, per-channel backfill, Enterprise Grid testing, Teams.

---

# Area 6 — Metering, billing, and the weekly digest

## 6.1 Metering: one append-only ledger, instrumented where the data already is

```sql
usage_events(id, tenant_id, metric, quantity, unit, occurred_at, ref_type, ref_id, meta jsonb)
-- metrics: llm_tokens{model,agent}, investigation_run, release_validation,
--          log_query{provider, bytes_scanned?}, repo_connected, service_active,
--          artifact_committed, slack_message
```

Sources are all things Phase 1 builds anyway: A3's `run_steps` already carries per-step tokens (emit a usage event per step — same write, second table); `tool_invocations` covers log queries; connector config covers repos/services. Hourly rollups (`usage_rollups`) → monthly invoice lines. The ledger is the single source of truth for billing, the COGS dashboard, budget enforcement, *and* digest stats — build it once in week 1, because retrofitting metering is miserable and you're pricing on it.

**Per-tenant cost accounting:** `run_steps.tokens × model price table (versioned — prices change)` → per-run cost → per-tenant monthly COGS, sitting next to MRR in an internal margin view. You will discover that one tenant's pathological incident loop is eating your margin **only** if this view exists.

## 6.2 Pricing: pushback on "per repo + log volume"

Two problems with the stated model. **(1)** Session 1 chose query-in-place — you don't ingest log volume; CloudWatch Insights scan costs land on the *customer's* AWS bill. Billing on a quantity you neither incur nor observe well is incoherent. **(2)** "Repo" is your unit, not the buyer's — a monorepo org with 30 services pays less than a polyrepo org with 10. The unit the buyer already thinks in is the **service** (so does your whole architecture: quality scores, signatures, policies are all per-service).

Recommended model: **platform fee by active-service band** (e.g., ≤10 / ≤40 / unlimited tiers — an *active* service has a connected log source, which neatly prices the value boundary) **+ included investigation volume + overage packs** (an investigation = one bounded agent run, RCA or release validation, with the A2 token budget making its COGS predictable — you're selling a unit whose cost you control). LLM tokens are **never** customer-facing pricing: nobody budgets in tokens, and token-pricing puts your COGS negotiation inside every renewal. Enterprise: annual platform contract + committed investigation volume, usage true-up from the ledger. Billing engine: **Stripe Billing with usage meters**, ledger remains source of truth, rollups pushed to Stripe; never hand-roll invoicing.

## 6.3 Cost controls (this is COGS protection — Phase 1, not Phase 2)

Three nested enforcement layers, all reading the ledger:

1. **Per-run budget** (A2's budgeter, extended): token + tool-call + wall-clock caps; on breach → the degraded-finish path from session 1 §1.1 ("here's what I found before hitting the budget"), never a silent kill.
2. **Per-tenant monthly budget:** 80% → internal + customer alert; 100% → **graceful degradation, explicitly ordered**: model-tier downshift first → iteration caps lowered → signature-match-only mode (Tier 1/2 matching still runs — it's nearly free and still catches repeat incidents; the cognitive loop pauses) → manual-trigger-only. Each rung notifies. The product never silently goes dark mid-incident-season; it visibly narrows.
3. **Provider circuit breakers:** the existing LLM-layer failover, plus a per-tenant breaker for pathological loops (one tenant's webhook storm must not exhaust a shared provider quota).

## 6.4 The weekly digest

**Computation — "highest-risk service":**

```
risk(s) = 0.30·incident_load      (severity-weighted, 14d half-life decay)
        + 0.25·repeat_signatures  (same signature ≥2× in window — the strongest
                                   signal: a diagnosed-but-unfixed systemic issue)
        + 0.15·deploy_risk        (deploys × warned/breached fraction, from the ledger)
        + 0.15·critical_gaps      (open gaps on tier-weighted artifacts: runbooks,
                                   log-schema, release-policy)
        + 0.10·staleness          (freshness debt on operationally-weighted artifacts)
        + 0.05·centrality         (blast-radius in-degree from topology — being
                                   load-bearing raises the stakes of everything above)
```

All inputs already exist in the index + ledger. The same score orders the dashboard's service cards (§1.2) — one risk model, two surfaces, no drift.

**Template** (each section conditional — render nothing over an empty week; a padded digest trains people to skim, then to mute):

```
OpsMind Weekly — Acme Corp — Jun 2–8
THE HEADLINE   payment-service is your highest-risk service: 4 incidents,
               all matching sig_8f3a (Redis pool exhaustion). Diagnosed each
               time; root config unchanged. → [View signature] [Assign action]
INCIDENTS      7 investigated · 5 confirmed correct · 1 corrected · 1 awaiting
               review (#4521 — your confirmation improves future accuracy →)
LEARNED        2 new signatures · 9 org facts promoted · checkout-service
               topology confirmed via runtime traces (3 edges static→confirmed)
RELEASES       11 validated · 9 clean · 2 warned (1 → incident, caught at +6m)
KNOWLEDGE      quality 0.58 → 0.64 (CloudWatch connected) · top gap: rollback
               runbook for payment-service (+0.06) → [Answer in 2 min]
CALIBRATION    sig_8f3a now 6/6 confirmed → eligible for auto-runbook on next
               match. [Enable] [Not yet]
```

Two honesty rules, enforced structurally: every number traces to run persistence + outcome capture (no vanity metrics — Phase 1 may **never** claim "auto-resolved"; it claims "investigated, N confirmed correct", which is what calibration supports), and the CALIBRATION section is the **only** place autonomy upgrades are sold — the digest is exactly where the receipts ("6/6 confirmed") sit next to the ask, which is the autonomy ladder from session 1 finding its product surface.

**Delivery & cadence:** Slack to the org default channel (primary; the digest is a *conversation starter* — replies to it go straight to Mindy) + email fallback + dashboard archive. **Weekly, full stop.** A daily digest for high-activity orgs is the wrong fix — high activity means real-time needs, which notifications (§5.4) already serve; a faster digest just gets muted sooner. One exception: an **incident-spike supplement** (≥3 incidents in 48h → a mid-week mini-digest scoped to that cluster), event-driven rather than scheduled.

**CTAs:** every line's CTA maps to an existing write path — confirm an RCA (E4), answer a gap (clarification queue), connect a source (incremental onboarding), enable signature autonomy (the checkbox from session 1 §0.4). The digest creates no new mechanisms; it's pure routing into loops that already close.

**Phase placement (Area 6).** `usage_events` + per-run cost accounting = **week 1, inside WS-A3** (same instrumentation pass). Budgets + degradation ladder = week 3–4 (extends A2). Digest v1 = **week 7** (a scheduled job over tables that exist by then + one Slack post — cheap, and it's your retention surface during quiet weeks when no incidents are reminding anyone you exist). **Deferred:** Stripe integration (Phase 2 — design partners are on contracts; ledger accuracy now, invoicing automation later), margin dashboard polish, incident-spike supplement, pricing-page self-serve.

---

# Revised Phase 1 sequence

Session 1's WS-A…G stand. This session adds four workstreams and two amendments, and grows Phase 1 honestly:

| WS | Scope | Weeks | Depends on |
|---|---|---|---|
| A–G | as session 1, plus: **A3 + usage ledger** (§6.1); **B2 merge_update = block-ownership spec** (§1.1); **WS-G = Slack thread streaming, made concrete** (§5.3) | 1–6 | — |
| **WS-H** | Release agent: stages 1–4 + report (wk 5–6); monitoring window + RCA handoff (wk 6–7) | 5–7 | C, D |
| **WS-I** | Slack core: install/tenancy/inbox (4–5) · RCA threads + routing + confirm/correct (5–6) · Mindy intake + fact extraction (6–7) · connect-flow screens (3–6) | 3–7 | A, G |
| **WS-J** | Dashboard: org home + service pages + gaps/dispute write path (4–6) · onboarding live view (5–6) · neighborhood graph + incident overlay (6–7) | 4–7 | B |
| **WS-K** | Budgets + degradation ladder (3–4) · digest v1 + retro-RCA delivery (7) | 3–7 | A3, E, I |

Honest accounting: Phase 1 is now **~8 weeks with two more engineers than session 1's plan assumed**, or ~10 weeks without. If forced to cut, cut in this order: incident graph overlay → org-cluster detection → fact extraction v1 (keep "remember that" instant-promotion only) → release monitoring window (ship observe-only). Do **not** cut: the usage ledger (retrofit is brutal), block ownership (it *is* B2), Slack confirm/correct (it's E4's fuel and the calibration data every other promise rests on), or the retro-RCA (it's the cheapest deal-closer in the whole plan).

The through-line of this session, stated once: every surface designed above — blocks, gaps, digests, threads, release reports — is a different rendering of the same small set of stores (spine, signatures, gaps, facts, ledger, runs) flowing through the same two interfaces (Writer in, Reader out). Hold that line in implementation and the product layer stays coherent; break it for one convenient shortcut and you'll spend Phase 2 reconciling parallel sources of truth.All eight items are complete: the repo grounding was done up front (release agent prototype, ContextRepo viewer, Mindy/Telegram surfaces), and the response delivered production-grade designs for all six areas plus the revised Phase 1 sequencing with workstreams WS-H through WS-K.