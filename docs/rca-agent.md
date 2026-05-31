# RCA Agent

## Purpose
Generate operational root cause analysis reports from incidents and service logs.

## Responsibilities
- ingest incidents
- correlate traces
- analyze failures
- generate recommendations
- persist RCA reports
- extract reusable skills

## Runtime Characteristics
- bounded execution
- deterministic analysis
- explicit uncertainty
- traceable evidence chains

## Outputs
- incident_summary.md
- root_cause.md
- trace_flow.md
- recommendations.md

## Edge Cases
- missing onboarding context
- missing trace ids
- ambiguous incidents
- incomplete logs
- partial tool failures