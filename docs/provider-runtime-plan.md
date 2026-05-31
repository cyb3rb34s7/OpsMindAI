# Provider Runtime Plan

## Goal
Make the LLM layer provider-agnostic by contract.

## Providers
- OpenAI
- Claude
- Bedrock
- Groq
- OpenRouter
- Ollama
- DeepSeek

## Contract
- unified request model
- unified response model
- adapters normalize outputs
- runtime never parses provider-specific payloads directly

## Review
- no provider leakage into runtime
- no hidden fallback provider switching
- consistent structured-output handling
