# Phase 3.1 — Onboarding Agent

## Objective
Build deterministic onboarding intelligence workflows that transform raw repositories
into operational context artifacts.

## Runtime Philosophy
- heuristic-first detection
- deterministic orchestration
- explicit failures
- no recursive autonomous crawling
- operational artifacts over chat summaries

## Deliverables

### GitHub Scanner
Fetch:
- repository metadata
- README
- top-level files
- dependency manifests
- infra indicators

### Repository Analyzer
Detect:
- tech stack
- deployment patterns
- infrastructure
- CI/CD
- operational topology

### Context Artifact Generator
Generate:
- project_index.md
- tech_stack.md
- service_map.md
- open_questions.md

### Onboarding Agent
Workflow:
scan -> analyze -> generate -> persist -> return report

## Edge Cases
- Large repo protection
- Partial scan warnings
- Explicit GitHub failures
- Missing README handling

## Review Checklist
- no hidden fallbacks
- deterministic outputs
- lean modules
- traceable runtime
- explicit operational reporting