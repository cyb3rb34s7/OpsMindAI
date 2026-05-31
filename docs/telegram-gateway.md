# Telegram Gateway

## Purpose
Provide a transport-only surface for OpsMindAI conversations.

## Responsibilities
- accept messages
- assign a trace id
- forward to orchestrator
- return structured results

## Endpoint
`POST /api/v1/telegram/webhook`

## Design Rules
- no routing logic in the transport layer
- no business inference in the webhook
- all intent classification happens in the orchestrator
