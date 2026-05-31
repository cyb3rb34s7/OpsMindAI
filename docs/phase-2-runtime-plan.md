# Phase 2 — Database + Agent Runtime

## Objective
Build durable operational runtime infrastructure before implementing domain agents.

## Research-Informed Decisions

### Hermes-Inspired
- procedural skill memory
- persistent execution state
- reusable operational patterns

### LangGraph-Inspired
- explicit state machine
- durable execution
- step persistence

### PydanticAI-Inspired
- typed contracts
- structured tool outputs
- validation-first runtime

## Runtime Philosophy
Deterministic orchestration with constrained reasoning.

## Deliverables

### Database Foundation
- db.py
- SQLModel engine/session
- operational models

### Runtime Models
- customers
- agent_runs
- tool_runs
- skills

### Base Runtime
- BaseAgent
- BaseTool
- ExecutionContext
- AgentResult
- ToolResult

### Runtime Guarantees
- explicit failures
- trace persistence
- iteration protection
- tool observability
- no silent retries

## Review Checklist
- customer_id scoped
- trace_id propagated
- explicit runtime states
- no broad exception swallowing
- maintainable module boundaries