# Phase 3.2 — RCA Agent

## Objective
Build deterministic operational RCA workflows using trace correlation and contextual analysis.

## Workflow
Incident
  -> Context Loading
  -> Log Ingestion
  -> Trace Correlation
  -> Failure Analysis
  -> Recommendation Generation
  -> Skill Extraction
  -> RCA Report Persistence

## Design Decisions

### Deterministic Analysis
Heuristic operational analysis preferred over unrestricted LLM reasoning.

### Trace-Centric Correlation
trace_id is the primary operational correlation primitive.

### Explicit Uncertainty
Agent must explicitly lower confidence when evidence is incomplete.

### Structured Operational Reports
Reports generated as persistent markdown artifacts.

## Deliverables
- Incident models
- Mock log ingestion
- Trace correlation engine
- RCA analyzer
- RCA report generator
- Skill extraction pipeline

## Review Checklist
- no hallucinated certainty
- explicit failures
- deterministic execution
- trace propagation preserved
- maintainable module boundaries