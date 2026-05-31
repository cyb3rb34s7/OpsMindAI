# OpsMindAI Architecture

## Architectural Philosophy

OpsMindAI is designed as a deterministic AI operational workflow platform,
not an autonomous AGI system.

Core principles:
- Explicit orchestration
- Structured outputs
- Traceability-first
- Shared infra multi-tenancy
- Fail closed
- No silent fallbacks

## Why Relational DB
PostgreSQL/SQLite chosen over MongoDB because:
- Strong operational relationships
- Traceability
- Transactional consistency
- Easier observability
- Tenant isolation

Flexible metadata will use JSON columns later.

## Multi-Tenant Strategy
Shared infrastructure with:
- customer_id scoping
- trace_id propagation
- isolated logical data boundaries

## Backend Stack
- FastAPI
- Uvicorn
- PydanticAI
- SQLModel
- Redis
- asyncio

## Frontend Stack
- React
- Vite
- Tailwind
- TanStack Query

## Scaling Philosophy
Shared worker pools:
- onboarding workers
- RCA workers
- release workers

Queue depth drives scaling.