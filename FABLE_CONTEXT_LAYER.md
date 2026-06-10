# OpsMindAI — Fable Session 3: Enterprise Onboarding and the Context Layer

I re-read the prototype before writing this: `ContextRepoGenerator` (nine flat markdown files, delete-and-rewrite, all tenants in one host repo), the CodeiQ output set (1,342 nodes / 2,711 edges / 174 files at demo scale — the `calls` edge count, 218, tells you how much meaning static analysis alone leaves on the table), and the onboarding agent's `OnboardingReport` schema. Everything below is consistent with the fixed decisions: git-canonical + derived Postgres/pgvector index, block ownership, Writer/Reader as the only I/O paths, the provenance ladder, CodeiQ, Temporal, the connector pyramid.

This document is the implementable spec for the onboarding system and the context layer it produces. The hard decisions are made, not deferred. The sharpest claims are up front.

---

# 0. The thesis: Lake → Ledger → Canon

Everything in this design follows from one architectural decision, so state it first.

**The mistake every enterprise-knowledge product makes is conflating three different stores that have three different jobs:**

1. **The Lake** — the raw corpus. Every fetched page, ticket, PR, transcript, PDF, diagram. Object storage (S3), content-addressed, immutable, cheap, complete. *Never* in git. *Never* in the context repo. Indexed for retrieval (chunks + embeddings + FTS in Postgres), but presence in the Lake asserts nothing about truth or value.

2. **The Ledger** — extracted, atomic, provenance-tagged **claims**, and the adjudicated **facts** they corroborate. Postgres. A claim is "document X, written by Alice in 2021, asserts that checkout calls payment-service synchronously." A fact is the adjudicated output of many claims: "checkout → payment-service, HTTP, synchronous; confidence 0.94; corroborated by code analysis + 3 documents + 1 human; current as of 2026-06." The Ledger is where deduplication, contradiction, staleness, and authority live. It is the system's *epistemology*.

3. **The Canon** — the context repo in git. Small, curated, synthesized, block-structured artifacts. Every sentence in the Canon is backed by facts in the Ledger; every fact cites claims; every claim cites a span in the Lake. The Canon is what humans read and edit, what `compile()` draws narrative from, and what the customer keeps if they leave.

The flow is strictly one direction with one feedback loop:

```
 Sources ──connectors──▶ LAKE (S3 raw + Postgres chunk index)
                           │  tiered extraction (mostly lazy)
                           ▼
                         LEDGER (claims → adjudication → facts, edges, entities)
                           │  synthesis (Writer.merge_update, citation-or-silence)
                           ▼
                         CANON (git context repo) ──indexer──▶ query plane
                           ▲                                      │
                           └── human edits, agent write-backs ◀───┘
                                      (Reader serves agents; agent usage
                                       feeds demand signals back to triage)
```

Three consequences, each resolving one of this brief's provocations:

- **"Should 5,000 Confluence pages go to git?" No.** The Canon at 100-service scale is ~1,500–2,500 files (sized in §4). The 5,000 pages live in the Lake, searchable, citable, and *deepened on demand*. Git stays human-navigable; the corpus stays complete. Writing everything to git would destroy both properties at once.
- **"Is the onboarding agent an ingester or a curator?" A curator.** Ingestion is cheap and indiscriminate (the Lake takes everything). *Understanding* is expensive and ruthlessly prioritized. The agent's job is choosing what to read deeply, what to distill into the Canon, and — explicitly — what to leave in the Lake untouched. The exclusion list is a first-class output (§8.3).
- **"Is 'knowledge graph' the right mental model?" Half of it.** The graph (entities + typed edges) is the skeleton. The Ledger's claims-with-timelines are the flesh. A knowledge graph without temporal adjudication confidently serves 2016 truths; a document index without a graph can't answer "what reads payments_db?" in 50ms. You need both, and the schema in §3 is both in one Postgres database.

One more principle used everywhere, named once: **citation-or-silence.** No LLM-synthesized statement enters the Canon, a fact, or an agent-visible compile result without a resolvable citation chain (fact → claims → source spans). A synthesis model that cannot cite must emit a gap, not a sentence. This single rule is the difference between a context layer and a hallucination amplifier, and it is mechanically enforceable (§2.7).

---

# 1. The ingestion layer — source connectors

## 1.1 The connector contract

A connector's only job is to move bytes and metadata from a source into the Lake, incrementally, politely, and resumably. Connectors do **zero** interpretation — no chunking, no classification, no LLM. Everything downstream consumes one envelope, which is what makes the registry extensible:

```python
class RawItem(BaseModel):
    source_type: str                  # "confluence" | "jira" | "github" | ...
    source_key: str                   # stable ID within the source: "SPACE/12345", "PROJ-4821"
    parent_key: str | None            # hierarchy (Confluence ancestry, Jira epic, repo)
    url: str | None
    title: str
    mime: str                         # what the payload actually is
    payload_uri: str                  # s3://lake/{tenant}/{source}/{sha256}
    content_hash: str                 # sha256 of payload; identity for change detection
    created_at_source: datetime | None
    updated_at_source: datetime | None
    author: str | None                # raw author string; entity-resolved later
    acl: RawACL                       # source-native access descriptor (§7.7)
    native_meta: dict                 # labels, view counts, issue type, PR state, ...

class SourceConnector(Protocol):
    source_type: ClassVar[str]
    capabilities: ClassVar[set[str]]  # {"incremental", "webhooks", "acl", "history", "binary"}

    async def validate(self, creds: ConnectorCreds) -> ValidationReport
    async def discover(self, creds, cursor: Cursor | None) -> AsyncIterator[ItemRef]
    async def fetch(self, creds, ref: ItemRef) -> RawItem        # writes payload to S3, returns envelope
    async def acl_principals(self, creds) -> AsyncIterator[PrincipalGroup]  # group→member sync, if capable
```

Each connector run is a **Temporal workflow**: `discover` paginates and emits `ItemRef`s; `fetch` runs as parallel activities with bounded concurrency; every completed item advances a **per-(tenant, source) cursor** persisted in `connector_cursors`. A crash at page 3,000 resumes at page 3,001 because the cursor is the source's own change token (Confluence `next` link + max `lastModified` seen; Jira `updated >= cursor` JQL; GitHub `since` SHAs; Slack `latest` ts), not our loop counter. Per-item failures go to a dead-letter table with the error and retry budget; a connector run that completes with 2% dead-lettered items is a *successful run with gaps recorded*, never a failed run.

**Rate limiting** is centralized, not per-connector: a token-bucket service keyed `(tenant, source_type)` with provider profiles (Atlassian: ~10 rps sustained, honor `Retry-After` absolutely; GitHub: budget against the 5,000/h installation quota and read `X-RateLimit-Remaining`, switch to GraphQL for PR history to cut request counts ~10×; Slack: Tier-3 ~50 rpm on `conversations.history`; Google: per-user quotas, batch API). Initial backfills are scheduled as low-priority lanes so a 50,000-ticket Jira pull never starves the incremental lane that keeps fresh sources current. Budget rule: **backfill may take days; freshness may not lag hours.** This ordering is a product decision, not an infra accident — day-one value comes from code + the high-value document slice, not from corpus completeness.

**Registry.** Connectors are plugins: a package registering `(source_type, connector_class, capabilities, cred_schema, provider_profile)` in a `connector_registry` table. The pipeline knows only `RawItem`. Adding SharePoint touches zero pipeline code. Two built-in fallbacks cover the long tail without deep connectors:
- **File-drop**: upload a Confluence space export, a zip of Word docs, a Notion export. Same envelope, `source_type="filedrop"`, no incremental capability, ACL defaults to org-restricted until labeled.
- **URL fetch**: single pages (a public design doc, a wiki page), polled weekly.

## 1.2 Per-source specifics (the ones that bite)

**GitHub/GitLab.** Three distinct streams, not one:
- *Code*: shallow clone per repo into the scan workers (not via API). CodeiQ runs from the clone (§2.6).
- *PR history* — the underexploited signal. Pull via GraphQL: title, body, review threads, linked issues, merged_at, changed paths. A PR is a **decision document with a diff attached**: "why" lives in descriptions and review threads, and `changed paths → CodeiQ symbols` gives you the only document type in the whole estate that is *natively linked to code*. Backfill the last 24 months of merged PRs; skip dependabot/renovate by author filter at discover time (typically 30–60% of PR volume, near-zero prose signal — they feed the dependency timeline from lockfile diffs instead, which is deterministic).
- *Commit history*: messages only, last 12 months, used for deploy/change timelines and author→service affinity (§7.2), not for prose extraction.

**Confluence.** Use REST v2 with `body.atlas_doc_format` — ADF is a JSON tree, which makes structural chunking (§2.3) exact instead of HTML-scraping heuristics. Fetch per page: ADF body, ancestry path, labels, version history (count + last 5 editors + dates), restrictions (ACL), and attachments. Macros: expand `include`/`excerpt` (they hide real content), capture `drawio`/`gliffy`/`plantuml` attachments as diagram items (§7.4), replace dynamic macros (Jira filters, user lists) with typed placeholders — a Jira-filter macro becomes a *link* claim ("this page tracks PROJ-xxx"), never fake text. View/like counts come from the analytics API when the license allows; absence degrades the value score, it doesn't block (§2.2). History matters: `version.count` and edit recency are authority inputs, and the *historical versions* of high-value pages are fetched lazily only when contradiction resolution needs them (§7.1).

**Jira.** Discover by JQL slices ordered by `updated DESC` (newest first — recency correlates with relevance, and it front-loads value during backfill). Fetch issue + all comments + changelog + links + custom fields. The brutal signal-to-noise is handled by triage (§2.2), not by the connector — fetch everything (a ticket is ~2–5 KB; 50,000 tickets ≈ 200 MB in the Lake, irrelevant), *read* almost nothing. The changelog is deterministic gold: status transitions, assignee history, component changes — that's ownership history and incident timelines with zero LLM cost.

**Google Docs / Notion / SharePoint.** Export to a normalized intermediate: Google Drive API `export` to DOCX→Docling (§6.1) or to HTML for simple docs; Notion API gives blocks (a JSON tree like ADF — same chunker family); SharePoint via Graph API, files → the PDF/Office path. All three have usable change feeds (Drive `changes.list`, Notion `last_edited_time`, Graph delta queries) for incremental.

**PDFs / Word.** No special connector — they arrive as attachments or file-drops. Processing is §2.3/§6.1. The connector's only job: capture origin metadata (which Confluence page attached it, which Drive folder, when), because a PDF's authority is inherited from its container.

**Architecture diagrams.** Treated as a *document class*, not a source: they arrive via Confluence attachments, repo files, Miro/Lucid connectors, or file-drop. Source-format recovery is the key move and it is deterministic where it works: **draw.io embeds the full mxGraph XML inside its exported PNGs/SVGs** (the `mxfile` payload) — parse it and you get exact nodes, labels, and edges with no vision model; Mermaid/PlantUML/Structurizr in repos are text — parse; **Miro and Lucidchart REST APIs return shapes and connectors as structured JSON** — a real connector each, shipped in the second connector wave. Only flattened rasters (screenshots, exported PNGs without payloads, whiteboard photos) need the vision path (§7.4).

**API specifications.** Highest value per token in the estate. Discover by filename/content sniffing across repos and attachments (`openapi:`, `swagger:`, `.proto`, `.graphql`, Postman `info.schema`). Parse deterministically into per-operation records (§2.3). RAML and Word-doc "specs" get demoted to prose processing with a `spec_informal` class — do not pretend a Word doc is a contract.

**Slack/Teams history.** Phase-gated and consent-scoped exactly as session 2 §5.5 fixed: member channels only, mention/thread participation by default, per-channel 90-day backfill as an explicit opt-in offered for detected incident channels. The connector emits *thread-level* items (a thread is the document; loose channel messages are batched into daily digests per channel). Privacy: the §4 (session 2) extraction denylist applies at processing; the connector additionally drops messages from non-consented channels at discover time so they never enter the Lake.

**Runbook repos** are just GitHub repos with a hint: a repo or directory labeled `runbooks` at connect time gets `doc_class=runbook` pre-assigned and a triage boost — runbooks are operationally critical and chronically stale, exactly the combination the quality model wants to surface (§5).

**Meeting transcripts** (Zoom/Gong/Fireflies APIs or file-drop). Highest-provenance source for decisions: diarized speakers + dates + verbal commitments. Items are per-meeting; processing segments by topic (§2.3). Speaker names entity-resolve to people, which wires transcripts into authority scoring (§7.2). Pull recordings' transcripts only — never audio; we are not building ASR.

## 1.3 What the connector layer refuses to do

No interpretation, no filtering-by-guess (except hard denylists: dependabot PRs, non-consented Slack), no schema beyond the envelope, no writes anywhere but the Lake + cursor tables. Every byte fetched is content-hashed; refetching an unchanged item is a no-op upstream of everything (the hash short-circuits the pipeline). This is what makes "the corpus is never static" survivable: incremental cost is proportional to *change volume*, not corpus size.

---

# 2. The processing pipeline — raw data to structured knowledge

The pipeline is one Temporal workflow family with ten stages. Stages are idempotent on `(tenant, source_key, content_hash, stage_version)`; bumping a stage's version (new prompt, new model, new chunker) selectively reprocesses only that stage forward, only for affected items. That versioning rule is what lets you improve extraction quality for months without re-ingesting anything.

```
S1 envelope+dedup → S2 triage → S3 structural parse → S4 semantic chunking
→ S5 index (embed+FTS) → S6 tiered extraction → S7 entity resolution
→ S8 adjudication → S9 synthesis → S10 verification queue
```

Stages S1–S5 run on **everything** (cheap, deterministic or near-free). S6 is **tiered and mostly lazy**. S7–S8 run on whatever S6 produces. S9–S10 run per-service/per-topic, not per-document.

## 2.1 S1 — Envelope and dedup

Content-hash exact dedup (the same PDF attached to four pages is one Lake object with four `document` rows pointing at it). Near-dup detection via MinHash/LSH over normalized text (datasketch; 128 perms) — Confluence estates are full of copy-paste-then-drift pages; near-dups get clustered, the highest-authority member becomes the cluster representative, the rest are demoted in triage and *linked*, not dropped (drift between near-dups is itself a contradiction signal for §7.1).

## 2.2 S2 — Triage: the value score (no LLM)

Every document gets a deterministic value score in `[0,1]` from signals that cost nothing:

```
value(d) = w₁·recency(updated_at_source)               # exp decay, half-life 18mo
         + w₂·connectivity(in_links + out_links)       # log-scaled; links are votes
         + w₃·attention(views, watchers, comments)     # where available; else neutral prior
         + w₄·author_authority(author)                 # §7.2; neutral prior pre-resolution
         + w₅·position(hierarchy_depth, space_type)    # space homepage > depth-6 meeting notes
         + w₆·class_prior(doc_class_cheap)             # rule-based pre-class: title/label/path
                                                       #   regexes: ADR/RFC/runbook/post-mortem/
                                                       #   spec/onboarding > meeting notes > status
         + w₇·liveness(edit_count, distinct_editors)   # maintained docs > write-once docs
```

Weights start hand-set (0.20/0.20/0.15/0.15/0.10/0.15/0.05) and are re-fit per-tenant after week 2 against the only ground truth that matters: **demand** — which documents agent queries and human clicks actually retrieve (§5.4). The score routes documents into processing tiers:

| Tier | Population (target) | What happens | Cost driver |
|---|---|---|---|
| **T0 index-only** | 100% | S3–S5: parsed, chunked, embedded, searchable | embeddings (~$0.02/Mtok class) |
| **T1 skim** | top ~25–35% | cheap-model pass per doc: classify, 3-sentence synopsis, claim-candidate spotting, entity mentions | small LLM (Haiku-class) |
| **T2 deep** | top ~3–7% | frontier-model extraction: full claim/relationship/decision extraction with citations | frontier LLM |

The percentages are *budgets*, not constants — set from the tenant's corpus size and the onboarding cost envelope (§2.8). Two overrides: (a) **class floors** — every API spec, ADR, post-mortem, and runbook is at least T1 regardless of score; specs and ADRs are T2 unconditionally (they're rare and dense); (b) **demand promotion** — see §2.9, the most important rule in the pipeline.

## 2.3 S3/S4 — Structural parse and semantic chunking

Chunking is not one strategy; it is a per-format family with one invariant: **a chunk is a semantic unit with its context stapled on, never a character window.** Every chunk gets a `breadcrumb` (where it lives) and a `synopsis_prefix` (what its document is about, from T1 skim when available) prepended *for embedding only* — this is contextual-retrieval-style conditioning and it is the single highest-leverage retrieval trick available today: it lets a chunk about "the pool size" be findable as "payment-service DB connection pool configuration."

| Format | Parse | Unit | Notes |
|---|---|---|---|
| Confluence/Notion | ADF/block JSON tree | heading-bounded section, split at ~800 tok on paragraph boundaries, tables kept atomic | breadcrumb = space / ancestors / page / heading-path |
| Markdown/READMEs | mdast | same as above | code fences kept atomic with language tag |
| Jira | native structure | **episodes**: description = 1 unit; comments grouped into time-clustered runs (gap > 7 days splits) | changelog is structured data, never chunked |
| PRs | native | description = 1 unit; each review thread = 1 unit | changed-paths list attached as metadata, not text |
| Code | tree-sitter | symbol-level: function/method/class with signature + docstring + leading comment; file preamble unit for imports/constants | header = `repo / path / enclosing class / symbol`; only *hot* symbols embed (§2.6) |
| API specs | openapi parser / protoc / graphql SDL | **one unit per operation** (path+verb / rpc / field), plus one per schema/message | these become `observed` facts directly, no LLM (§2.5) |
| PDFs/Word | Docling layout model | layout sections; tables → both markdown text and structured rows | scanned pages → vision fallback (§6.1) |
| Transcripts | diarization JSON | topic segments: speaker-turn runs split by embedding-shift detection (~10-min cap) | speakers carried per segment |
| Slack threads | native | thread = document; root+replies windowed | permalinks per message preserved |
| Diagrams | §7.4 | the diagram is one unit; extraction output is claims, not chunks | original image kept addressable for human review |

Chunks: ~150k for a 5,000-page estate with attachments (≈30/page average) — trivial for pgvector HNSW (§3.4).

## 2.4 S5 — Index

Embed every chunk (model choice §6.4; model id and version stored per row), maintain `tsvector` FTS, and that's it. T0 documents are now *findable* — which is the precondition for lazy deepening. Nothing about T0 docs is asserted as fact; retrieval from a T0 doc surfaces raw text with its staleness banner (§7.1), clearly marked `provenance: unprocessed-source`.

## 2.5 S6 — Tiered extraction

**Deterministic extractors run first and outrank LLMs wherever they apply** (provenance `observed`): API specs → endpoint/operation facts; protos/SDL → contract facts; K8s/Terraform/docker-compose/helm in repos → deployment, datastore, env-var, and resource facts; CI configs → deploy-pipeline facts; lockfiles → dependency timelines; Jira changelogs → ownership/status history; CODEOWNERS → ownership claims; draw.io XML / Miro JSON → topology claims. A third of the useful graph comes out of these parsers at zero LLM cost, and it is the *most reliable* third.

**LLM extraction (T1/T2)** is schema-constrained against a closed claim-type taxonomy:

```
dependency | tech_choice | ownership | convention | decision | deprecation
| failure_mode | config_value | sla_constraint | compliance_constraint
| business_rule | capability | glossary_term | criticality
```

Every extracted claim must include: `claim_type`, `statement` (≤50 words, declarative, self-contained), `subject_mention` (+ `object_mention` for relational types), a **verbatim quote span** from the chunk, and `asserted_when` (in-text date if present, else document date). Validation is mechanical and merciless: the quote must be a substring of the chunk (else the claim is dropped and counted as extractor hallucination — a tracked metric per extractor version); mentions must survive entity resolution at ≥0.5 or the claim parks as `unresolved` (§7.6); hedged language ("we should probably") is extracted with `modality: proposal`, never as an assertion. Decision-shaped content additionally yields a `decision_record` candidate: `{decision, alternatives_considered, drivers, status, when, who}` — these reconstruct the missing 80% of ADRs (§4.3).

**Relationship extraction is biased toward the graph, deliberately.** For relational claim types, the extractor's output is a candidate edge, and the adjudicator's prior is set by reconciliation against code-derived topology: a prose edge matching a CodeiQ/runtime edge confirms and is absorbed (provenance stays `observed`, the doc becomes supporting evidence); a prose edge with *no* code counterpart enters at `derived`, confidence ≤0.6, and — when the subject service's code is fully scanned and a corresponding edge is absent — spawns a contradiction-class gap ("doc says checkout → billing; code shows no such call: historical, external, or missed dispatch?"). Prose never silently overrides code. Code never silently erases history — that's what the timeline is for (§2.7).

**What classical NLP does and doesn't do here:** we reject open-vocabulary OpenIE and spaCy-style relation extraction outright (precision on infra jargon is far below usable). Optional cheap pre-filter: GLiNER-style zero-shot NER to spot service/datastore mentions and *skip* T1 skims on chunks with zero operational entities — a cost optimization, never a truth source.

## 2.6 Code semantic extraction beyond CodeiQ

CodeiQ gives structure (files, symbols, imports, calls, endpoints, entities). Meaning is layered on top, ruthlessly selectively — the budget rule is **LLM reads are reserved for hot code**:

1. **Hotness ranking (deterministic):** rank symbols by `centrality in the call graph × reachability from entry points × change frequency (git) × incident adjacency (templates/signatures touching this file)`. The top ~5% of symbols in a 500K-line monolith is ~2,500 functions — readable.
2. **Path narration (T2):** for each entry point on a critical path, walk the call graph collecting the *actual code* of hot symbols along the path (depth-capped, ~6–10 symbols, ~4–8K tokens), one frontier call per path: emit `capability` claims ("POST /charge: validates → reserves ledger funds → writes payments_db → publishes payments.events"), `business_rule` claims with quote spans ("refunds over $10k require manual approval — `RefundPolicy.java:84`"), and `failure_mode` candidates (bare excepts, unbounded retries, missing timeouts — pattern-detected deterministically, LLM-narrated).
3. **Module dossiers (T1):** per package/module: cheap-model synopsis from signatures + docstrings + README fragments. This is the fallback meaning layer for the cold 95%.
4. **Cross-language linking:** where SCIP indexers are cheap to run (scip-java, scip-python, scip-typescript), use them to resolve cross-file references precisely and patch CodeiQ's `calls` undercount; where they aren't (legacy C#, old Ruby), accept import-level granularity and lean on runtime confirmation. LSP-as-a-service for nine languages is a tarpit — don't build it (§6.2).
5. **No-docstring legacy Java/C# is handled by exactly the above** — hotness says *what* to read, the call graph says *in what order*, and the entity map (which tables/models a symbol touches) anchors the narration in nouns the LLM can't invent. The output is honest: modules outside the hot set carry `meaning_coverage: synopsis-only` in `service.yaml`, which feeds quality (§5) and tells the RCA agent when it's flying on structure alone.

Per-language support is a capability matrix, not a promise: full (Python, TS/JS, Java, Go) / structural (C#, Ruby, Kotlin) / inventory-only (everything else: files, endpoints by framework regex, configs). The matrix is visible in the service's `service.yaml` — honesty about coverage is itself context.

## 2.7 S7/S8 — Entity resolution and adjudication

Entity resolution is §7.6 (it deserves its own section). Adjudication is the heart of the Ledger:

1. **Cluster** claims by `(subject_entity, predicate-family, object_entity?)` plus embedding similarity of statements for non-relational types.
2. **Build the timeline** per cluster: order claims by `asserted_when`. Detect **supersession** (a 2022 claim "Postgres" following a 2019 claim "MySQL" for `datastore_of(payment-service)` is not a contradiction — it's a migration): the fact table holds *both*, the old one closed with `valid_to`, the new one current. Detect **contradiction** (overlapping validity windows, incompatible values, comparable authority): unresolved → fact stays at the higher-authority value with `disputed=true` and a gap is emitted (one question closes it).
3. **Score** the fact: `confidence = f(best_provenance, Σ authority-weighted corroboration, source diversity, recency of latest corroboration)` — capped by provenance class (an `inferred` fact can never exceed 0.6 no matter how many low-grade docs repeat it; fifty copies of the same wrong wiki page are one vote, because near-dup clusters count once — that's why §2.1 keeps cluster links).
4. **Upsert** facts and edges with full evidence links (`fact_evidence`), preserving every claim's provenance — dedup without provenance loss, by construction.
5. **Emit** to synthesis: facts that crossed the canon threshold (confidence ≥0.7 or human-confirmed) and belong to a canon artifact's source set trigger `Writer.merge_update` for the affected blocks. Renderer blocks re-render from facts; agent blocks regenerate **only when their cited fact set changed** (citation-or-silence makes this dependency tracking exact: a block's sources are its citations).

## 2.8 Cost and latency envelope (honest numbers)

Reference estate: 75 services, 30 repos (one 500K-line monolith), 4,000 Confluence pages, 30,000 Jira tickets, 2,500 PRs/24mo, 400 attachments/PDFs, 60 diagrams, 40 transcripts.

| Stage | Volume | Cost class | Wall-clock (parallelized) |
|---|---|---|---|
| Connectors (backfill) | ~12 GB raw | API time, $~0 | 1–3 days (rate limits dominate; Jira longest) |
| Chunk + embed (T0, all) | ~25M tok | ~$50–150 | hours |
| T1 skim (~30%: ~9M tok in, small model) | | ~$100–300 | hours |
| T2 deep (~5%: ~2.5M tok in+out, frontier) | | ~$300–800 | hours |
| Code: CodeiQ all repos + SCIP where supported | 1.2M LOC | compute only | 1–4 h (monolith sharded by package) |
| Code: path narration (~150 paths) + dossiers | ~2M tok | ~$200–500 | hours |
| Adjudication + synthesis | ~50–150K claims | ~$100–300 | hours |
| **Total onboarding** | | **~$1–2.5K** | **first value < 1 h; canon v1 same day; corpus settled ≤ 1 wk** |

That COGS supports the platform-fee pricing from session 2 with room to spare, *because* of tiering — a naive deep-read-everything pass on the same estate is ~$25–60K and a week of frontier-model latency. Tiering is not an optimization; it is the difference between a viable product and a demo.

## 2.9 Demand-driven deepening — the rule that makes lazy correct

Every `Reader.search()` and `compile()` logs which chunks were retrieved, their tier, and whether the consumer (agent step or human click) used them (§5.4). **When a T0/T1 chunk is retrieved with high relevance into real work, its document is promoted one tier and queued for extraction — within minutes, by a standing Temporal worker.** The agents' queries become the curriculum: the corpus is processed in the order the work actually demands, not the order the crawler found it. Cold documents stay cold forever at near-zero cost; a document that matters during an incident is deep-read by the time the post-mortem is written. Triage misrankings self-correct: the value score only has to be *roughly* right on day one, because demand fixes it. This is the design's answer to the scale cliff: at 10× corpus size, T0 cost grows linearly (embeddings are cheap), and T1/T2 cost grows with *usage*, which is bounded by the customer's actual operational tempo, not their document hoard.

---

# 3. The knowledge graph schema

One Postgres database, RLS on `tenant_id` everywhere (policies elided below for brevity; every table has them). pgvector for embeddings, `tsvector` for FTS. The graph is tables, not a graph database — at 75 services the entity graph is ~10⁴ nodes / ~10⁵ edges, where recursive CTEs are comfortably sub-100ms and operational simplicity beats Cypher.

```sql
-- ============ identity ============
CREATE TABLE entities (
  entity_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  kind         text NOT NULL CHECK (kind IN
               ('service','datastore','queue_topic','endpoint','domain_entity',
                'team','person','repo','library','infra_component','environment',
                'external_vendor','business_domain','document_space')),
  canonical_name text NOT NULL,           -- slug: 'payment-service'
  display_name text,
  summary      text,                      -- one-liner, for embedding + UI
  attrs        jsonb NOT NULL DEFAULT '{}',
  embedding    vector(1024),
  status       text NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','merged','retired')),
  merged_into  uuid REFERENCES entities(entity_id),
  created_from text NOT NULL,             -- 'codeiq' | 'k8s' | 'human' | 'resolver'
  UNIQUE (tenant_id, kind, canonical_name)
);

CREATE TABLE entity_aliases (
  alias_id   bigserial PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  entity_id  uuid NOT NULL REFERENCES entities(entity_id),
  alias      text NOT NULL,
  alias_norm text NOT NULL,               -- lower, strip [-_./], collapse
  namespace  text NOT NULL,               -- 'k8s'|'jira'|'confluence'|'datadog'|'code:java'|'slack'|...
  confidence real NOT NULL,
  status     text NOT NULL DEFAULT 'proposed'
             CHECK (status IN ('proposed','confirmed','rejected')),
  evidence   jsonb,
  UNIQUE (tenant_id, namespace, alias_norm)
);
CREATE INDEX ON entity_aliases (tenant_id, alias_norm);          -- resolver hot path
CREATE INDEX ON entity_aliases (tenant_id, entity_id);

-- ============ the Lake's catalog ============
CREATE TABLE documents (
  doc_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL,
  source_type     text NOT NULL,
  source_key      text NOT NULL,
  parent_key      text,
  url             text,
  title           text NOT NULL,
  author_raw      text,
  author_entity   uuid REFERENCES entities(entity_id),
  created_at_source timestamptz,
  updated_at_source timestamptz,
  content_hash    text NOT NULL,
  payload_uri     text NOT NULL,
  mime            text NOT NULL,
  doc_class       text,                   -- 'adr'|'runbook'|'api_spec'|'post_mortem'|'design'|
                                          -- 'ticket'|'pr'|'page'|'diagram'|'transcript'|'thread'|...
  value_score     real,
  tier            smallint NOT NULL DEFAULT 0,        -- 0 indexed, 1 skimmed, 2 deep
  synopsis        text,                               -- from T1
  authority       real,                               -- §7.2, recomputed
  acl_label_id    uuid REFERENCES acl_labels(label_id),
  near_dup_cluster uuid,
  stage_versions  jsonb NOT NULL DEFAULT '{}',        -- {"chunk":3,"extract":7,...}
  status          text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','deleted_at_source','excluded')),
  excluded_reason text,                               -- curation is explicit (§8.3)
  UNIQUE (tenant_id, source_type, source_key)
);
CREATE INDEX ON documents (tenant_id, doc_class, value_score DESC);
CREATE INDEX ON documents (tenant_id, updated_at_source DESC);

CREATE TABLE doc_chunks (
  chunk_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  doc_id      uuid NOT NULL REFERENCES documents(doc_id) ON DELETE CASCADE,
  ordinal     int  NOT NULL,
  kind        text NOT NULL,              -- 'section'|'episode'|'symbol'|'operation'|'segment'|...
  breadcrumb  text NOT NULL,
  body        text NOT NULL,
  token_count int  NOT NULL,
  span        jsonb,                      -- source location for citation rendering
  embedding   vector(1024),
  emb_model   text,
  tsv         tsvector GENERATED ALWAYS AS
              (to_tsvector('english', left(breadcrumb,256) || ' ' || body)) STORED,
  entity_mentions uuid[],                 -- resolved mentions, for filtered retrieval
  UNIQUE (tenant_id, doc_id, ordinal)
);
CREATE INDEX doc_chunks_vec ON doc_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
CREATE INDEX doc_chunks_fts ON doc_chunks USING gin (tsv);
CREATE INDEX doc_chunks_ent ON doc_chunks USING gin (entity_mentions);

-- ============ the Ledger ============
CREATE TABLE claims (
  claim_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  doc_id       uuid NOT NULL REFERENCES documents(doc_id),
  chunk_id     uuid REFERENCES doc_chunks(chunk_id),
  claim_type   text NOT NULL,
  statement    text NOT NULL,
  quote        text NOT NULL,             -- verbatim; validated substring of chunk
  subject_entity uuid REFERENCES entities(entity_id),
  object_entity  uuid REFERENCES entities(entity_id),
  predicate    text,
  value        jsonb,
  modality     text NOT NULL DEFAULT 'assertion'
               CHECK (modality IN ('assertion','proposal','question','retraction')),
  asserted_when timestamptz,              -- when the source says it was true
  speaker_entity uuid REFERENCES entities(entity_id),
  authority    real NOT NULL,
  extraction_confidence real NOT NULL,
  extractor    text NOT NULL,             -- 'openapi-parser'|'llm:t2@v7'|...
  status       text NOT NULL DEFAULT 'candidate'
               CHECK (status IN ('candidate','adjudicated','unresolved','rejected')),
  embedding    vector(1024)
);
CREATE INDEX ON claims (tenant_id, subject_entity, predicate);
CREATE INDEX ON claims (tenant_id, status) WHERE status IN ('candidate','unresolved');

CREATE TABLE facts (
  fact_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL,
  fact_type    text NOT NULL,             -- mirrors claim_type taxonomy
  subject_entity uuid NOT NULL REFERENCES entities(entity_id),
  predicate    text NOT NULL,
  object_entity uuid REFERENCES entities(entity_id),
  value        jsonb,
  statement    text NOT NULL,             -- canonical rendering, ≤50 words
  confidence   real NOT NULL,
  provenance   text NOT NULL CHECK (provenance IN
               ('observed','human-confirmed','derived','inferred')),
  valid_from   timestamptz,
  valid_to     timestamptz,               -- NULL = current
  superseded_by uuid REFERENCES facts(fact_id),
  disputed     boolean NOT NULL DEFAULT false,
  negated      boolean NOT NULL DEFAULT false,   -- anti-facts: "does NOT use RabbitMQ (since 2021)"
  acl_label_id uuid REFERENCES acl_labels(label_id),  -- most restrictive evidence (§7.7)
  corroboration_count int NOT NULL DEFAULT 1,
  source_diversity    int NOT NULL DEFAULT 1,
  last_corroborated_at timestamptz,
  usage_count  int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  outcome_score real,                     -- reinforcement from confirmed/corrected RCAs (§5.4)
  stale_after  interval,
  embedding    vector(1024)
);
CREATE UNIQUE INDEX facts_current ON facts
  (tenant_id, subject_entity, predicate, COALESCE(object_entity,'00000000-0000-0000-0000-000000000000'::uuid))
  WHERE valid_to IS NULL;
CREATE INDEX facts_subject ON facts (tenant_id, subject_entity) WHERE valid_to IS NULL;
CREATE INDEX facts_vec ON facts USING hnsw (embedding vector_cosine_ops);

CREATE TABLE fact_evidence (
  fact_id   uuid NOT NULL REFERENCES facts(fact_id) ON DELETE CASCADE,
  claim_id  uuid NOT NULL REFERENCES claims(claim_id),
  role      text NOT NULL CHECK (role IN ('supports','contradicts','supersedes','retracts')),
  PRIMARY KEY (fact_id, claim_id)
);

-- ============ the operational graph (hot path) ============
-- Denormalized projection of relational facts, kept in lockstep by the adjudicator.
-- Exists so traversal never joins through facts.
CREATE TABLE edges (
  edge_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  src        uuid NOT NULL REFERENCES entities(entity_id),
  dst        uuid NOT NULL REFERENCES entities(entity_id),
  edge_type  text NOT NULL CHECK (edge_type IN
             ('calls_http','calls_grpc','publishes','consumes','reads','writes',
              'owns','on_call_for','deployed_in','contains','depends_lib',
              'documents','implements_spec','exposes')),
  confidence real NOT NULL,
  provenance text NOT NULL,
  fact_id    uuid REFERENCES facts(fact_id),
  attrs      jsonb NOT NULL DEFAULT '{}',
  valid_to   timestamptz
);
CREATE INDEX edges_out ON edges (tenant_id, src, edge_type) WHERE valid_to IS NULL;
CREATE INDEX edges_in  ON edges (tenant_id, dst, edge_type) WHERE valid_to IS NULL;

-- ============ access control (§7.7) ============
CREATE TABLE acl_labels (
  label_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  source_type text NOT NULL,
  definition jsonb NOT NULL,              -- source-native: space perms, security level, repo visibility
  visibility text NOT NULL DEFAULT 'restricted'
             CHECK (visibility IN ('org','restricted'))
);
CREATE TABLE principal_groups (
  group_id  uuid PRIMARY KEY, tenant_id uuid NOT NULL,
  source_type text NOT NULL, source_group_key text NOT NULL,
  UNIQUE (tenant_id, source_type, source_group_key)
);
CREATE TABLE group_members (
  group_id uuid REFERENCES principal_groups(group_id),
  person_entity uuid REFERENCES entities(entity_id),
  synced_at timestamptz NOT NULL, PRIMARY KEY (group_id, person_entity)
);
CREATE TABLE label_grants (
  label_id uuid REFERENCES acl_labels(label_id),
  group_id uuid REFERENCES principal_groups(group_id),
  PRIMARY KEY (label_id, group_id)
);

-- ============ canon registry, gaps, demand ============
CREATE TABLE artifacts (
  artifact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  path       text NOT NULL,               -- canon repo path
  service_entity uuid REFERENCES entities(entity_id),
  artifact_type text NOT NULL,
  content_sha text NOT NULL,
  quality    jsonb NOT NULL,              -- per-component scores (§5.1)
  indexed_at timestamptz NOT NULL,
  UNIQUE (tenant_id, path)
);
CREATE TABLE artifact_blocks (
  block_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  artifact_id uuid NOT NULL REFERENCES artifacts(artifact_id) ON DELETE CASCADE,
  omd_id     text NOT NULL,
  owner_class text NOT NULL CHECK (owner_class IN ('renderer','agent','human')),
  body       text NOT NULL,
  block_hash text NOT NULL,
  cited_facts uuid[],                     -- citation-or-silence, materialized
  embedding  vector(1024),
  tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', body)) STORED,
  UNIQUE (tenant_id, artifact_id, omd_id)
);
CREATE INDEX ON artifact_blocks USING gin (cited_facts);   -- "which blocks must regenerate?"

CREATE TABLE gaps (
  gap_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL,
  service_entity uuid REFERENCES entities(entity_id),
  gap_type   text NOT NULL CHECK (gap_type IN
             ('missing_artifact','contradiction','unresolved_entity','low_confidence',
              'stale','disputed','tribal','diagram_review','acl_blocked')),
  question   text NOT NULL,
  answer_mode text NOT NULL,              -- 'confirm'|'choice'|'freetext'|'connect:<src>'
  payload    jsonb,
  quality_gain real NOT NULL,
  demand_score real NOT NULL DEFAULT 0,   -- §5.4: how often agents needed this
  status     text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE context_demand (             -- every Reader query, logged
  demand_id  bigserial PRIMARY KEY,
  tenant_id  uuid NOT NULL,
  consumer   text NOT NULL,               -- 'rca-agent@run:7f3c'|'human:dashboard'|...
  task_kind  text,
  query      text,
  top_chunk_ids uuid[],
  top_score  real,
  used       boolean,                     -- consumer cited/clicked it
  miss       boolean,                     -- nothing above relevance floor
  at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON context_demand (tenant_id, at DESC);
```

## 3.1 Hot queries and their plans

**Typed lookup, <50ms:** `Reader.service('payment-service')` = one alias lookup + one `facts_subject` index scan + one `edges_out/in` scan. All index-only at this scale.

**Traversal, <500ms:** blast radius / neighborhood:

```sql
WITH RECURSIVE hop AS (
  SELECT e.dst, e.edge_type, e.confidence, 1 AS depth,
         ARRAY[e.src, e.dst] AS path, e.confidence AS path_conf
  FROM edges e
  WHERE e.tenant_id = $1 AND e.src = $2 AND e.valid_to IS NULL
    AND e.edge_type = ANY($3)
  UNION ALL
  SELECT e.dst, e.edge_type, e.confidence, h.depth + 1,
         h.path || e.dst, LEAST(h.path_conf, e.confidence)
  FROM hop h JOIN edges e
    ON e.tenant_id = $1 AND e.src = h.dst AND e.valid_to IS NULL
   AND e.edge_type = ANY($3)
  WHERE h.depth < $4 AND NOT e.dst = ANY(h.path)        -- cycle guard
)
SELECT DISTINCT ON (dst) dst, depth, path, path_conf
FROM hop ORDER BY dst, path_conf DESC;
```

Depth ≤4 over ~10⁵ live edges with the partial indexes above: tens of milliseconds. Confidence propagates as `min` along the path (session 2's rule, kept).

**Hybrid retrieval:** FTS (`tsv @@ websearch_to_tsquery`) and vector (HNSW, `ef_search=80`) in parallel, reciprocal-rank-fusion in SQL, optional entity filter via `entity_mentions && $entities`, top-40 → reranker (§6.4) → top-8. P95 well under 500ms.

## 3.2 What gets embedded (and only this)

| Object | Why | Granularity |
|---|---|---|
| `doc_chunks` | retrieval workhorse | semantic unit + breadcrumb + synopsis prefix |
| `facts.statement` | dedup clustering; "what do we know about X" semantic lookup; signature-prior matching | one per fact |
| `claims.statement` | adjudication clustering only | one per claim |
| `entities` (name+aliases+summary) | entity resolution candidate generation | one per entity |
| `artifact_blocks` | canon retrieval (block-level RAG, session 2's granularity win) | one per block |

Not embedded: raw code below the hot-symbol cut, Jira changelogs, anything structured (you query structure with SQL, not similarity). Re-embedding on model upgrade is a background Temporal sweep keyed on `emb_model` — the column exists so two models can coexist mid-migration; queries pin one model id.

## 3.3 Rebuildability discipline

Fixed decision honored with one refinement: the **Canon** is rebuildable from git alone; the **Ledger and Lake catalog** are rebuildable from the Lake (S3) + connector replay; embeddings and FTS are rebuildable from either. What is *not* rebuildable is the Lake itself and human actions (confirmations, dispute resolutions, ACL grants) — human actions therefore always write through to git (the Canon's audit trail) as session 1 fixed, and the Lake's S3 bucket is the one store with cross-region replication. The index remains disposable; "disposable" now formally means "rebuildable from S3 + git," and a `rebuild_tenant_index` Temporal workflow exists from day one and runs in staging weekly as a drill.

---

# 4. The context repo (Canon) at enterprise scale

## 4.1 Folder structure, 100-service shape

```
context-repo/
  _meta/
    manifest.json                  # schema_version, domains, service registry (slim), counters
    sources.json                   # every connected source: type, scope, cursor age, item counts
    coverage.json                  # per-source x per-service processing-tier histogram
    ingestion-ledger.jsonl         # append-only pipeline events (rotated monthly, archived to S3)
    exclusions.md                  # curation refusals: what we chose NOT to canonize, and why (§8.3)
  org/
    overview.md                    # what the company runs, for whom; the 5-minute orientation
    domains.md                     # domain → services map (rendered from entity graph)
    topology.json                  # cross-service edges, per-edge provenance+confidence (unchanged)
    glossary.md                    # entity dictionary: canonical names, aliases, one-liners (rendered)
    conventions.md                 # org-wide conventions + promoted org facts (Mindy's, per session 2)
    business/
      context.md                   # products, customers, revenue-critical paths
      slas.md                      # external commitments, rendered from sla_constraint facts
      compliance.md                # PCI/SOC2/HIPAA constraints mapped to services
    people/
      teams.yaml                   # team → services, channels, escalation (rendered)
  decisions/                       # THE reconstructed decision trail (org-level)
    index.md                       # timeline view, rendered
    {year}/{slug}.md               # decision records: real ADRs imported + reconstructed ones
                                   #   frontmatter: status, drivers, evidence[], confidence,
                                   #   reconstructed: true|false
  domains/{domain}/                # 8–15 domains at 100 services; the human nav layer
    overview.md                    # domain narrative, key flows crossing it
    services → (registry links)    # no duplication; cards rendered in dashboard from index
  services/{service}/              # session 1 §2.2 layout, kept verbatim, plus:
    service.yaml                   #   + meaning_coverage, language matrix, source_bindings
    knowledge.md                   # NEW: synthesized "what the documents say" dossier (§4.2)
    decisions.md                   # NEW: service-scoped decision timeline (rendered slice of /decisions)
    api/  architecture/  observability/  operations/  incidents/  changes/  ownership/  onboarding/
  kb/                              # cross-cutting topic dossiers (§4.2)
    topics/{slug}.md               # 'kafka-usage', 'auth-architecture', 'pci-scope', 'redis-fleet'
    patterns/recurring-issues.md   # mined from Jira: recurring bug patterns with ticket evidence
  diagrams/
    {slug}/extracted.json          # extraction output + review status
    {slug}/source.{png,xml,…}      # only curated diagrams; the rest stay in the Lake
```

Sizing: 100 services × ~14 files + ~60 decisions + ~40 topics + org layer ≈ **1,700–2,400 files**. Git handles this trivially; humans navigate it because the *domains* layer caps any directory listing at ~15 entries and the dashboard renders from the index anyway (session 2 §1.2 — files are the portable rendering, not the UI).

## 4.2 The granularity decision: dossiers, not mirrors

**One file per Confluence page is wrong** and this design forbids it. Per-page mirrors duplicate the Lake into git (bloat), freeze noise into the Canon (quality collapse), and break block ownership (whose blocks are they?). The Canon's unit is the **dossier**: a synthesized, block-structured artifact per *topic* or per *service-facet*, written by S9 synthesis from facts, citing sources by stable reference:

```markdown
<!-- omd:block id=kafka-consumers owner=agent confidence=0.81 cites=f_2a91,f_30bb,f_41c2 -->
## Who consumes payments.events
ledger-service (runtime-confirmed) and reconciliation-worker (static + doc-confirmed).
fraud-scorer consumed it until 2023-11 (decommissioned — JIRA INFRA-5512).
[src: code-graph; Confluence “Payments Eventing” (2024-03, J. Ortiz); INFRA-5512]
<!-- /omd:block -->
```

Citations render as footnote links: Lake documents get deep links into the dashboard's source viewer (which serves the raw page/ticket with the quoted span highlighted), never copied wholesale into git. `services/{s}/knowledge.md` is the per-service dossier ("what the document estate says about this service that code doesn't"); `kb/topics/` holds cross-cutting ones. Topic selection is data-driven: a topic earns a dossier when ≥8 high-value documents or ≥25 facts cluster on an entity/theme that is not service-shaped — Louvain over the fact co-citation graph proposes them, the curator confirms.

## 4.3 The decision trail

`decisions/` holds two populations under one schema: imported real ADRs (`reconstructed: false`, provenance `observed`) and **reconstructed decision records** — S6's `decision_record` candidates, adjudicated across sources (the Jira comment + the PR description + the transcript fragment that all describe the RabbitMQ exit get merged into one record with three evidence links, `reconstructed: true`, provenance `derived`, confidence shown in the header). Reconstructed records are the product's single most demo-able artifact for engineering leadership — "here are 40 architectural decisions from your last five years, with evidence; 11 are marked low-confidence, confirm or correct them" — and each confirmation is a one-tap promotion to `human-confirmed`. A decision whose subject services are all retired is auto-archived, not deleted (the timeline is the value).

## 4.4 Block ownership and re-ingestion safety (unchanged, now load-bearing)

All S9 writes go through `Writer.merge_update` at block granularity, exactly as fixed. Re-ingestion safety follows mechanically: human blocks are never touched; renderer blocks regenerate from facts (whose human confirmations persist in the Ledger); agent blocks regenerate only when `cited_facts` changed. The prototype's delete-and-rewrite (`for old in repo_dir.glob("*.md"): old.unlink()`) is dead, replaced wholesale; nothing in `ContextRepoGenerator._render_markdown`'s flat-file model survives except the *idea* of `open_questions.md`, which became the gaps system.

---

# 5. The quality model

## 5.1 Scoring, extended

Per-artifact (session 1's four components, kept) plus two new components the Ledger makes computable:

```
quality(a) = 0.25·completeness + 0.20·provenance_weight + 0.15·freshness
           + 0.15·verification + 0.15·corroboration + 0.10·demand_satisfaction
```

- **corroboration** — mean source-diversity-weighted corroboration of the artifact's cited facts. An artifact resting on single-source `derived` facts scores low even if complete and fresh; this is the anti-confident-wiki-rot term.
- **demand_satisfaction** — of the Reader queries that *should* have been served by this artifact's domain (task-kind heuristic), what fraction found relevant content above the floor? Computed from `context_demand`. This is the term that makes quality mean "useful," not "tidy."

Per-service rollup stays operationally weighted (signatures, service.yaml, log-schema, runbooks heaviest). Per-org adds **coverage**: against an expected-artifact model per service tier (a tier-1 service missing a rollback runbook hurts org score; a tier-3 internal tool missing one doesn't). Per-fact, separately, `confidence` already exists; the dashboard's quality ring (session 2) gains the two new segments.

## 5.2 Gap leverage, data-driven

```
leverage(gap) = quality_gain × consumer_criticality × (1 + demand_score)
```

`demand_score` accumulates from `context_demand.miss` rows mapped to the gap's domain — a gap agents actually hit during investigations outranks a schema-completeness gap every time. This replaces session 1's static ranking with a measured one; the formula is otherwise unchanged so all session-2 surfaces (ring, checklist, digest) work as designed.

## 5.3 Cold start: why day one is useful at quality 0.3

Day-one quality is dominated by what's deterministic: code structure (`observed`), specs (`observed`), infra configs (`observed`), plus T2 extraction of the spec/ADR/post-mortem floor classes. That is precisely the substrate the no-priors RCA path (session 1 §1.5) needs: topology, endpoints, datastores, deploy pipelines, log bindings. The document estate's contribution *grows* over week one as tiering and demand-promotion work through it. The product story is honest: "on day one it knows what your code does; within a week it knows what your org knows; within a quarter it knows what your org has forgotten."

## 5.4 The usage feedback loop (closing it concretely)

Three signals, all from infrastructure that already exists in the plan:

1. **Retrieval logging** (`context_demand`): every Reader call records hits, scores, and consumer; `used=true` when the agent's final output cites the chunk/fact or the human clicks it. Feeds tier promotion (§2.9), demand_satisfaction (§5.1), gap demand (§5.2), and triage-weight refitting (§2.2).
2. **Outcome propagation:** when an RCA is confirmed (session 2's one-tap), every fact cited in its causal chain gets `outcome_score += w`; corrected RCAs propagate negative signal to the facts the wrong chain rested on — flagging *specific* context as suspect, with a `low_confidence` gap if it drops below threshold. Confirmed-incident usage is the strongest verification that exists; it outranks any human "looks right" click.
3. **Compile-miss escalation:** an agent `compile()` returning below the relevance floor for a task-critical slot (e.g., no log-schema for the alerted service) emits a gap *during the run* and is eligible for the in-thread contextual clarification (session 2 §2.5).

## 5.5 Keeping it current — the metabolism

Incremental updates are the same pipeline, narrowly scoped: webhook/cursor event → affected `RawItem`s → hash check → changed items reflow S3→S8 → adjudicator computes the **fact delta** → only blocks citing changed facts regenerate → one `merge_update` commit per affected artifact. Cost is proportional to change volume; a typical enterprise's daily delta (50 commits, 30 ticket updates, 10 page edits) reprocesses in minutes for cents.

Scheduled maintenance (Temporal cron, per tenant):
- **Decay sweep** (daily): freshness recompute; facts past `stale_after` with zero recent corroboration → confidence haircut; crossing the floor → `stale` gap ("still true that…?" — re-verification, not deletion).
- **Contradiction repair** (daily): new claims contradicting current facts → adjudication queue; unresolved >7 days → clarification question.
- **Consolidation** (weekly): near-duplicate fact merge, dossier re-synthesis for topics with ≥N changed facts, glossary refresh, demand-driven triage-weight refit.
- **Drill** (weekly, staging): index rebuild from S3+git (§3.3).

---

# 6. Tools and technologies — build vs buy, with tradeoffs

## 6.1 Document processing

| Need | Pick | Why / tradeoffs |
|---|---|---|
| PDF/Word/PPT extraction | **Docling** (IBM, MIT-licensed) primary | best open layout+table model family; runs local (no doc exfiltration — enterprise requirement); slower than naive parsers. Fallback chain: PyMuPDF for born-digital simple PDFs (fast path), **vision-LLM page render** for the ugly tail (scanned, multi-column, CAD-ish). Skip unstructured.io (quality ceiling) and hosted parsers (data residency objections). Tesseract only as last-resort OCR; the vision path beats it on everything but cost |
| Confluence | REST v2 + ADF JSON, custom parser | export formats lose macros and ACLs; ADF is exact. Build cost ~1–2 wks, no real alternative |
| Markdown/HTML | mdast / readability + custom | commodity |
| Diagrams | draw.io mxGraph XML parser (build, ~days); Miro/Lucid REST connectors; **vision extraction: frontier multimodal with structured output** (§7.4) | no off-the-shelf "diagram→topology" tool is production-grade today; this is genuinely build territory |
| Chunking | **build** structure-aware segmentation per §2.3 on tree-sitter / ADF / mdast / Docling layout | LangChain/LlamaIndex splitters are character-window tools wearing semantic hats; chunk quality is too load-bearing to outsource. The build is small (~2 wks) because parsers do the hard part |
| Dedup | datasketch MinHash/LSH | commodity, battle-tested |
| Transcripts | provider APIs (diarization included) + embedding-shift topic splits | don't build ASR or diarization, ever |

## 6.2 Code intelligence

- **tree-sitter** for symbol extraction across all nine languages (uniform, fast, no toolchain needed) — this is CodeiQ's substrate already; extend, don't replace.
- **SCIP indexers** (scip-java, scip-python, scip-typescript, scip-go) where the build toolchain is available, for precise cross-file/cross-repo reference resolution. Tradeoff: they need buildable code; legacy estates often aren't. Run them opportunistically, treat output as a precision patch on CodeiQ, never a dependency.
- **Reject LSP-as-a-service**: per-language servers needing per-repo build environments at onboarding time is an ops tarpit for marginal gain over SCIP-where-possible + tree-sitter-everywhere.
- **Business-logic extraction from legacy Java/C#**: no tool exists; it's the §2.6 hot-path narration pattern (deterministic candidate detection + bounded frontier reads). Anyone claiming a product does this is selling you §2.6 with worse triage.

## 6.3 Fact and relationship extraction

Schema-constrained frontier/small LLM extraction with mechanical validation (§2.5) — build, because the validation harness *is* the product's epistemic integrity. GLiNER (Apache-2) as optional cheap NER pre-filter. Reject spaCy dependency-pattern relation extraction and OpenIE (precision on infra prose is unusable). Evaluate extraction with a labeled 300-chunk per-tenant-class sample (build once; §10).

## 6.4 Embeddings and reranking

- **Primary: Voyage** — `voyage-3-large` (prose+structured, strong multilingual) and `voyage-code-3` (hot code symbols), 1024-dim. Rationale: best code-retrieval benchmarks among hosted models, Matryoshka dims keep pgvector rows small, and one vendor for both simplifies ops. 
- **Fallback / data-residency tier: BGE-M3** (open weights, self-hosted, dense+sparse) — some enterprises will forbid sending document text to any third party; the abstraction (model id per row, §3.2) makes this a config, not a fork. Accept ~5–8% retrieval-quality haircut.
- **Reranker:** `voyage rerank-2` hosted, `bge-reranker-v2-m3` self-hosted. Rerank top-40→8 on every hybrid query; it's the cheapest large quality win in retrieval.
- pgvector HNSW is sufficient to ~5M chunks/tenant — far beyond the design point; no dedicated vector DB, period (operational surface, tenancy duplication, and the index must stay rebuildable-from-Postgres-backup anyway).

## 6.5 Pipeline substrate

Temporal (fixed). S3 + lifecycle policies for the Lake. Postgres 16 + pgvector + RLS (fixed). No Kafka in Phase 1 — Temporal activities + the webhook inbox carry the event volume comfortably below ~10⁵ events/day/tenant; revisit only when OTLP intake (session 1 §3.1) ships.

---

# 7. Enterprise-specific problems

## 7.1 The staleness cliff

Solved at three levels, all automatic, all already present in the schema:

- **Document level:** age + liveness in the value score (§2.2) means a 2016 page can barely reach T2; retrieval surfaces every chunk with a staleness banner computed from `updated_at_source` and class half-life (runbooks decay in months; ADRs *don't decay* — a 2016 decision is permanently true *as a decision* — which is why staleness is class-relative, not absolute).
- **Fact level:** temporal adjudication (§2.7) means old claims build the *history*, not the present: the 2016 "MySQL" claim closes a fact interval rather than competing with 2022's "Postgres." The agent asking "what's the datastore" gets the current fact; the agent asking "why is there mysql2 in old requirements files" gets the timeline. Both are right answers because **knowledge is a timeline, not a snapshot**.
- **Relationship level:** edges carry `valid_to`; the topology the RCA agent traverses is the *current* subgraph by construction (partial indexes enforce it), while `deps_history` queries remain possible for archaeology.
- The agent-facing rule, enforced in `compile()`: content older than its class half-life with no recent corroboration is delivered with an explicit `[unverified since 2019]` tag, and the RCA report's provenance citation (fixed decision) propagates it. "I don't know" beats 2016-as-gospel because the compile budget *prefers an empty slot plus a gap* over a sub-floor stale hit — that preference is a one-line policy in the budgeter and it is the whole cliff, solved.

## 7.2 The authority problem

Authority is a per-document score, recomputed weekly, used in triage (§2.2), claim weighting (§2.7), and conflict resolution:

```
authority(d) = 0.25·author_score(d.author)      # tenure overlap with subject, commit/edit
                                                #   volume on subject services, org-chart role
             + 0.20·recency(d)                  # class-relative half-life
             + 0.20·link_centrality(d)          # PageRank-style over the doc link graph
             + 0.15·liveness(d)                 # edit count × distinct editors
             + 0.10·attention(d)                # views/watchers where available
             + 0.10·code_proximity(d)           # does it cite real symbols/endpoints/configs
                                                #   that resolve against the code graph?
```

`code_proximity` is the novel and most discriminating term: a doc whose claims *check out against the code* earns authority mechanically; marketing-adjacent architecture fiction scores zero on it. `author_score` uses git history + Jira assignment history + transcript participation to estimate who actually works on what — including people who left (their docs keep historical authority for the period they were active, decaying after departure). Fifteen contradictory payment-service docs resolve as: per-claim adjudication (not per-doc winner-take-all), authority-weighted, code-reconciled, with surviving disagreements becoming one targeted clarification question rather than fifteen documents of confusion.

## 7.3 The tribal knowledge problem

Tribal knowledge is elicited by *making the system's ignorance specific*. People won't fill out a wiki, but they will correct a machine that is confidently almost-right and they will answer a sharp question that proves someone did the homework. Mechanisms, in order of yield:

1. **Contradiction questions** (§2.7) — "Doc A (2021) says X, the code says Y; which is current?" Near-100% answer rates because they're 5-second taps with visible stakes.
2. **Reconstructed decisions** (§4.3) — "We believe you moved off RabbitMQ in 2021 because of operational load (evidence: INFRA-4821, PR #2210). Confirm?" Confirms history *and* teaches the team the system reads their trail.
3. **The retro-RCA** (session 2 §2.4) — unchanged; its corrections are tribal knowledge captured at the moment of maximum motivation.
4. **In-incident contextual questions** (session 2 §2.5) — answered at 10× queue rates; every answer is a fact with `human` provenance.
5. **The interview generator**: for each service, the gap table renders a *persona-batched* questionnaire (deploy questions to the deploy owner, SLA questions to the EM; ownership from §7.2's author affinity) — max 10 questions, each showing what it unlocks, mostly `confirm`/`choice` mode, delivered as a 10-minute Slack/dashboard session per persona during week one. Budgeted exactly as session 2 fixed (5/week-one, 10 open max). This is the only *push* elicitation; everything else is pull-at-moment-of-relevance, which is what keeps it from feeling like interrogation.

## 7.4 The diagram problem

What's actually possible today, honestly: structured-source recovery (draw.io XML-in-PNG, Miro/Lucid APIs, Mermaid/PlantUML text) covers 40–70% of real estates **deterministically** — always do this first, it's free truth. For flattened rasters, frontier multimodal models read **boxes and labels well (~90%+), arrow existence moderately (~70–85%), arrow *direction* and crossing-line attribution poorly (~50–70%), legends/swimlane semantics poorly**. So the vision path is built for partial credit:

1. Vision pass with structured output: `{nodes:[{label,kind_guess}], edges:[{a,b,direction:confirmed|ambiguous,label}], legend_detected, confidence}`.
2. Node labels entity-resolve (§7.6); resolved nodes make the diagram *about* something.
3. Edges reconcile against known topology: matches → corroborating claims (cheap confidence boost, exactly what diagrams are best for); novel edges → `inferred`, conf ≤0.5, queued.
4. **Human annotation is the right call when:** the diagram is high-traffic (top-N by link centrality), vision confidence is low, and its novel edges would change the topology. The review UI shows the image with the extraction overlaid; confirming/redrawing an edge is one click each. Budget: ~10 diagrams per estate get human review; the rest contribute corroboration only. Never let an unreviewed raster-derived edge into a blast-radius computation above 0.5 confidence — that rule is enforced in the adjudicator, not in hope.

## 7.5 The scale cliff

What actually breaks at 50 services / 5,000 pages, and the countermeasure already in the design: API rate limits (lane-prioritized backfill, §1.1); LLM cost (tiering + demand-laziness, §2.2/§2.9); embedding/index volume (pgvector fine to ~5M chunks; §6.4); monolith scan time (shard CodeiQ by package/module with per-shard checkpoints; a failed shard dead-letters without failing onboarding — session 1's requirement, kept); adjudication fan-in (claims arrive in the 10⁵ range — clustering is batched per entity, not global; the `facts_current` unique index makes upserts contention-free per subject); synthesis storms (debounce per artifact, 15-min coalescing window); Temporal history size (continue-as-new per 1,000 items — a 50K-ticket backfill is ~50 workflow generations, routine). The honest remaining cliff is **entity resolution review volume** at 100 services (§7.6's confirmation queue can reach a few hundred items) — mitigated by auto-confirm thresholds and by front-loading the 20 highest-centrality entities where mistakes actually hurt.

## 7.6 The entity resolution problem

The resolver is its own subsystem because *everything* keys on it (claims, edges, ACLs, authority, dossiers):

1. **Seed deterministically** from the highest-trust namespaces: CodeiQ service segmentation, K8s/compose/helm manifests, IaC, CI configs, Datadog/CloudWatch service tags. These create canonical entities with `observed` provenance.
2. **Mine aliases per namespace**: normalization (case/`[-_./ ]`/stopwords: `PaymentService` ≡ `payment_service` ≡ `payment-service`), affix stripping (`-svc`, `-service`, `-api`, `-worker`, team prefixes), abbreviation expansion learned from co-occurrence ("pay-svc" appears in K8s next to payment-service's image name → alias, conf 0.9), embedding similarity over entity summaries as candidate generation only.
3. **Score and gate**: `match(mention, entity) = string_sim × namespace_prior × context_overlap` (context = co-mentioned entities in the chunk vs the entity's known neighbors — "payment" in a Datadog dashboard that also shows `payments_db` resolves confidently; "payment" in a finance doc doesn't). ≥0.9 auto-link; 0.6–0.9 link-as-proposed (usable, marked); <0.6 → claim parks `unresolved`.
4. **Humans confirm the head, not the tail**: the glossary review during onboarding (§8.2) shows the top ~30 entities with their mined alias sets — two minutes of confirmation locks the namespace mappings that 90% of mentions flow through. The tail self-resolves via demand (an unresolved alias that keeps appearing in retrieved chunks gets a gap).
5. **Merge/split are first-class** (`merged_into`, status) — wrong merges get split with alias reassignment; all claims/facts re-key by entity id so the operation is metadata-only.
6. "payment" in Datadog ≡ "pay-svc" in K8s ≡ `PaymentService` in Java: resolved by 1 (K8s+Datadog seeds), 2 (affix+normalization), 3 (context), with the glossary as the human backstop. This is also why the glossary is a Canon artifact — it's the resolver, rendered.

## 7.7 The access control problem

Hard rules, decided here:

- ACLs are captured at ingestion (`RawACL` → `acl_labels`), **deny-by-default**: unparseable or unknown ACLs → `restricted` with an `acl_blocked` gap, never silently public.
- Claims inherit their document's label. **A fact's effective label is the most restrictive label among the evidence that determines its confidence at the current grade.** If public evidence alone supports the fact at ≥ the same confidence, the fact is public *with citations filtered to public evidence per requester*. If the restricted evidence is load-bearing, the fact is restricted — full stop, even though the *statement* might seem innocuous; existence leaks.
- `Reader` calls carry a principal set (user → synced group memberships; agent → its capability scope). Compile/search/lookup filter facts, chunks, and blocks by label grants. **Autonomous agents run at org-public scope** (session 2 §4.5's rule, generalized from Slack facts to the whole layer): an unattended RCA posted to a public channel cannot cite a restricted ADR. When a restricted fact *would have changed the answer*, the report says so without revealing it: "additional context exists in a restricted source ([Confluence space: payments-security]); a member of that space can re-run this investigation" — an honest pointer, no leak, and a built-in nudge for the access owner to confirm or widen.
- The Canon is the subtle case: git has no row-level security. Resolution: **the main context repo contains org-visible content only**; restricted facts synthesize into per-label overlay artifacts stored in the index (and optionally a separate restricted repo per label for the customer's own audit), rendered into the dashboard only for cleared principals. This is the one place the Canon's "git is the whole truth" simplification bends, and it bends explicitly and narrowly rather than leaking implicitly.
- Group membership syncs daily per source; revocation propagates on sync (≤24h) or immediately via webhook where the source supports it. Document the SLA honestly in the security review packet.

## 7.8 The multi-language codebase problem

Already dissolved by §2.6's capability matrix + tree-sitter uniformity + SCIP opportunism: every language gets structure; hot languages get meaning; the matrix is visible in `service.yaml` and priced into the quality score. The one additional rule: **cross-service edges never depend on intra-language precision** — they come from specs, infra configs, queue declarations, and runtime confirmation, which are language-neutral. A C# service whose internals are inventory-only still has exact topology, endpoints (from its OpenAPI spec), and deploy facts — which is most of what incident-time reasoning needs.

---

# 8. The onboarding experience

## 8.1 The honest value ladder (extends session 2 §2.1 for the document estate)

- **T+10 min** (GitHub connected): service map, entity glossary draft, first service deep-dive readable. *Expectation set on screen: "Reading your documents takes longer; here's the live count."*
- **T+1 h** (Confluence/Jira connected): **the corpus map** — "4,812 pages found; 1,390 queued for reading; 287 flagged high-value; 61 likely-stale duplicates; 14 diagrams detected (9 with recoverable structure)." The map itself is the first document-estate value: nobody at the customer has ever seen their knowledge debt quantified.
- **T+1 day**: Canon v1 — service dossiers, glossary, draft decision timeline, contradiction list, first interview batches; retro-RCA if PagerDuty connected.
- **T+1 week**: corpus settled, clarification cycles 1–2 done, quality typically 0.45→0.6, reconstructed decisions confirmed/corrected.

The "onboarding complete" state is explicitly **not** "everything processed" — it is: *all sources cursored and current; all floor-class documents (specs/ADRs/runbooks/post-mortems) deep-read; the head of the value ranking processed; demand-driven deepening armed; interview round one delivered.* The completion screen says exactly that, with the coverage histogram (`_meta/coverage.json` rendered), because the alternative — implying total comprehension — sets the product up to be "caught" not knowing a page some engineer remembers, when the right answer is visible tiering: "that page is indexed; ask about it and I'll read it deeply right now."

## 8.2 New connect-flow steps (extends session 2 §2.2; everything there stands)

After service confirmation: **glossary review** (top-30 entities + aliases, 2 minutes, §7.6) — placed early because it multiplies everything downstream. After corpus map: **curation preview** — the proposed exclusion list (§8.3) and floor-class list for one-click adjustment ("actually, read the `platform-archive` space; ignore `marketing`"). Per-source **scope pickers** (spaces, projects, repos) double as the politics instrument (§8.4).

## 8.3 Curation is explicit: the exclusion ledger

The onboarding agent's refusals are written down: `_meta/exclusions.md` lists what was *not* canonized and why ("`/marketing` space: no operational entities resolved; 312 near-dup meeting-notes pages: cluster reps kept, members demoted; `old-wiki` space: superseded by `platform` space per 2023 migration page"). This is the §9 "curator, not ingester" principle made auditable — and it converts the scariest enterprise question ("what did it do with all our stuff?") into a readable answer. Exclusion is reversible (a demand hit on an excluded doc un-excludes it, §2.9) and visible in the dashboard.

## 8.4 Politics

- **Scoped consent per team**: connect-flow scope pickers mean a skeptical team's spaces/repos simply aren't connected; their services exist in the Canon at inventory quality, visibly lower-scored — the quality differential *is* the internal sales pitch, made by the dashboard rather than by anyone's manager.
- **Team-lead review**: each service's Canon v1 can require owner sign-off before org-wide visibility (a per-service flag; default off for speed, on for tender orgs). The review surface is the dispute/edit flow that already exists (session 2 §1.2) — no new machinery.
- **Sensitive-knowledge quarantine**: §7.7's labels mean "shared broadly" is a per-source decision the customer controls, with restricted overlays for cleared eyes only. The pitch to the skeptical lead is concrete: *your* pages stay in *your* ACL; what the org sees is the fact that a restricted source exists.
- **The CTO report**: week-one artifact rendered from the Ledger — knowledge-debt quantification (stale runbook count, contradiction count, single-source bus-factor facts, services with zero docs), decision-trail reconstruction stats. It makes the sponsor look right in front of the people who were skeptical, which is what actually secures the rollout.

---

# 9. What hasn't been done before (and is being done here)

Stated plainly, the five genuinely novel commitments of this design, each answering one provocation:

1. **Lake → Ledger → Canon distillation** (§0): the context repo is a *curated synthesis with citations*, not an ingestion target. Nobody ships this today: RAG products ship the Lake with embeddings; wiki products ship a hand-written Canon; knowledge graphs ship a Ledger nobody can read. The product is the *pipeline between the three*, with humans editing the top layer and demand reshaping the bottom.
2. **Demand-driven deepening** (§2.9): the corpus is processed lazily in the order real agent work demands, making cost proportional to operational tempo instead of hoard size. The agents' queries are the curriculum.
3. **Time-aware adjudication — knowledge as timeline** (§2.7, §7.1): claims are evidence about the world *at a time*; facts have validity intervals; supersession is a first-class outcome distinct from contradiction; **negated facts** ("we do NOT use RabbitMQ — since 2021") are stored and served, because the most expensive wrong answers are confident assertions of discontinued truths.
4. **Citation-or-silence with mechanical enforcement** (§0, §2.5, §3's `cited_facts`): every canon sentence and every compile result resolves to quote spans in sources, validated as substrings at extraction time and materialized as block→fact dependencies — which is simultaneously the trust story, the regeneration dependency graph, and the prompt-injection containment (ingested text is evidence to be cited, never instructions to be followed).
5. **The metabolism** (§5.5): decay, contradiction repair, consolidation, and reinforcement as standing scheduled processes over the Ledger — the "living organism" framed not as a metaphor but as four cron workflows with SQL semantics.

And one refusal, also a decision: **no universal ontology.** The claim-type taxonomy is closed and small (14 types); everything that doesn't fit stays retrievable text in the Lake rather than being force-fit into triples. Ontological ambition is where enterprise knowledge graphs go to die; this design keeps the graph small, operational, and ruthlessly typed, and lets retrieval handle the long tail.

---

# 10. Honest assessment: hardest parts, likely failures, open research

**Hardest to get right (in order):**
1. **Relationship-extraction precision from prose.** Even schema-constrained, expect 10–20% of `derived` prose edges to be wrong or stale at extraction. The mitigations (code reconciliation, confidence caps, contradiction gaps) contain it, but blast-radius and compile must keep treating sub-0.7 doc-only edges as hints. Measure from week one with the labeled sample; this metric gates how much the RCA agent is allowed to lean on doc-derived topology.
2. **Entity resolution's long tail.** The head resolves cleanly; the tail (retired services, renamed teams, "the gateway" meaning three different things across eras) will produce wrong links that quietly corrupt facts. The `merged_into`/split machinery and demand-surfaced `unresolved` gaps are the safety net; budget standing curation attention here, permanently.
3. **Authority cold start.** Author scoring needs weeks of git/Jira history mining before it discriminates; early adjudication leans on recency + code-proximity alone, and some early facts will be confidently wrong. Acceptable because confirmation flows exist from day one — but expect it and message it.
4. **ACL fidelity.** Confluence permission APIs are genuinely painful (space + page restrictions + group nesting); deny-by-default protects correctness at the cost of over-restriction noise (`acl_blocked` gaps). The failure mode to fear is silent leakage; the design trades availability to avoid it, deliberately.
5. **Cost variance.** A 200K-ticket Jira or a 20K-page Confluence breaks the §2.8 envelope. The tier budgets are the throttle — they must be *enforced* (hard caps with "deepening continues next week" messaging), not aspirational.

**Likely failure modes to instrument from day one:** extractor hallucination rate (quote-validation failures per extractor version); adjudication flip-flop (facts oscillating between values — signals an authority or near-dup bug); synthesis drift (agent blocks regenerating without fact changes — citation bookkeeping bug); retrieval miss rate by task kind (`context_demand.miss` — the single best health metric for the whole layer).

**Open research (timeboxed spikes, not blockers):** vision-model diagram edge-direction accuracy on a 50-diagram labeled set (1 wk — sets the §7.4 confidence ceiling empirically); learned triage (replace hand weights with a small ranker trained on demand data once ≥3 tenants exist); cross-tenant pattern priors (failure-signature archetypes shared *as schemas, never as data* — legal review before design); Confluence analytics API availability across license tiers (affects two value-score terms; degrade gracefully).

**Phase placement.** This session refines WS-B and adds two workstreams to the session-2 sequence: **WS-L (Lake + connectors + triage + index: S1–S5, GitHub/Confluence/Jira connectors, file-drop)** weeks 1–4, and **WS-M (Ledger: extraction, resolver, adjudication, synthesis S6–S9 + metabolism crons)** weeks 3–7, with WS-B's Writer/Reader/indexer becoming the Canon's I/O exactly as specified there. The eval harness requirement (session 1, WS-F) extends to extraction: the 300-chunk labeled sample and the extractor-hallucination metric ship *with* WS-M, not after it. Cut order if forced: Miro/Lucid connectors → transcripts → vision diagram path (keep deterministic recovery) → learned triage refit (keep hand weights). Do not cut: the Ledger's temporal adjudication (it *is* the staleness answer), citation validation, demand logging (every later loop feeds on it), or the exclusion ledger (it's the curation principle made real).

---

## Final shape, in one paragraph

Connectors fill a content-addressed Lake and never interpret. A deterministic value score and a small set of class floors decide what gets read, a tiered extractor turns the chosen slice into quote-validated claims, and agent demand continuously re-decides what gets read next. An adjudicator with temporal semantics turns claims into facts-with-intervals, contradictions into questions, and relational facts into a typed Postgres graph that answers in milliseconds. Synthesis distills facts into a small, block-owned, citation-bearing git Canon that humans edit and agents compile from, under ACLs inherited from the sources and a quality model whose strongest term is whether the context actually served the work. Four cron jobs keep it alive; one labeled sample and four counters keep it honest. If the context layer is excellent, every agent becomes excellent almost for free — this is the version of excellent that can actually be built, and the order to build it in.
