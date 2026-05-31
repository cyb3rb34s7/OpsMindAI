# Phase 6 — Execution Convergence

## Objective
Unify routing, agent cognition, provider adapters, tool execution, and persistence into one execution graph.

## Problems Fixed
- mocked provider adapters
- disconnected cognition layer
- heuristic analyzers
- keyword-based routing
- empty tool registry
- missing API endpoints

## Target Flow
FastAPI Route
→ Orchestrator
→ RoutingAgent
→ Specialized Agent
→ CognitiveRunner
→ LLM Client
→ Provider Adapter
→ Tool Registry
→ Tool Execution
→ Reflection Loop
→ Structured Report
→ Persistence

## Rules
- no hardcoded if/else domain decisions in analyzers
- tools gather evidence only
- agents perform reasoning
- runtime remains bounded
- providers remain pluggable and normalized
- failures are explicit
