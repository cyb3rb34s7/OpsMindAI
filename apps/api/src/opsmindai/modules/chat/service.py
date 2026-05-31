"""Chat turn logic: route → run an agent (live events) or answer from memory."""
from __future__ import annotations

import json
import re
from typing import Awaitable, Callable

from opsmindai.agents.base.schemas import ExecutionContext
from opsmindai.agents.cognition.schemas import RouteDecision
from opsmindai.agents.onboarding.agent import OnboardingAgent
from opsmindai.agents.rca.agent import RCAAgent
from opsmindai.agents.release.agent import ReleaseAgent
from opsmindai.modules.memory.service import memory
from opsmindai.shared.llm.base.models import LLMRequest
from opsmindai.shared.llm.client import LLMClient
from opsmindai.shared.trace import generate_trace_id

Emit = Callable[[str, dict], Awaitable[None]]

TRACE_RE = re.compile(r"trace_\w+", re.IGNORECASE)
REPO_RE = re.compile(r"https?://github\.com/[^\s]+", re.IGNORECASE)

CHAT_ROUTER_PROMPT = """You route a DevOps engineer's message to one of four intents:
- rca: investigating an incident / error / failing service / a trace id
- onboarding: onboarding or scanning a repository
- release: deploying, releasing, or a release gate
- general: a question or chat answerable from memory (architecture, risks, history)
Return intent, confidence (0-1), and a one-sentence reasoning."""

CHAT_SYSTEM_PROMPT = """You are OpsMindAI, an autonomous DevOps agent talking to an engineer.
Answer using the MEMORY below — what you know about their system, recent
conversation, past incidents, and learned skills.

Reply in plain conversational prose: 1-4 short sentences. Do NOT output JSON,
key/value objects, or code fences (an inline shell command is fine). Be concise
and operational. If the memory doesn't cover something, say what you'd need
rather than inventing incident details."""


async def _route(message: str, provider: str | None) -> dict:
    client = LLMClient(provider=provider)
    req = LLMRequest(
        system_prompt=CHAT_ROUTER_PROMPT,
        user_prompt=message,
        response_schema=RouteDecision,
        max_tokens=300,
    )
    try:
        resp = await client.generate(req)
        d = RouteDecision.model_validate(resp.structured_output)
        return d.model_dump()
    except Exception:
        # Fall back to deterministic routing if the router call fails.
        if TRACE_RE.search(message):
            return {"intent": "rca", "confidence": 0.9, "reasoning": "Detected a trace id."}
        if REPO_RE.search(message):
            return {"intent": "onboarding", "confidence": 0.9, "reasoning": "Detected a GitHub URL."}
        return {"intent": "general", "confidence": 0.6, "reasoning": "Answering from memory."}


async def _converse(customer_id: str, message: str, ws: dict, provider: str | None) -> str:
    client = LLMClient(provider=provider)
    req = LLMRequest(
        system_prompt=f"{CHAT_SYSTEM_PROMPT}\n\n# MEMORY\n{ws['prompt_block'] or '(no memory yet)'}",
        user_prompt=message,
        max_tokens=350,
    )
    resp = await client.generate(req)
    return resp.content.strip()


async def _run_agent(agent, customer_id: str, payload: dict, emit: Emit):
    ctx = ExecutionContext(
        trace_id=generate_trace_id(),
        customer_id=customer_id,
        agent_run_id=f"chat_{generate_trace_id()}",
        emit=emit,
    )
    return await agent.run(ctx, payload)


async def run_turn(customer_id: str, thread_id: str, message: str, emit: Emit, provider: str | None = None) -> None:
    # 1. persist the user turn + build the working set (always-on memory load)
    memory.store(customer_id, "conversation", f"user: {message}", thread_id=thread_id, importance=3)
    ws = memory.build_working_set(customer_id, thread_id, message)
    await emit("memory", {"used": ws["used"]})

    # 2. route (visible orchestrator decision)
    route = await _route(message, provider)
    await emit("routing", route)
    intent = route.get("intent", "general")

    reply = ""
    try:
        if intent == "rca":
            m = TRACE_RE.search(message)
            if not m:
                reply = "Which trace ID should I investigate? (e.g. `trace_123`)"
                await emit("reply", {"text": reply})
            else:
                result = await _run_agent(RCAAgent(provider=provider), customer_id,
                                          {"trace_id": m.group(0), "description": message,
                                           "incident_id": f"CHAT-{m.group(0)}"}, emit)
                if result.success:
                    rep = result.data["report"]
                    pct = round(rep["confidence"] * 100)
                    reply = f"Root cause: {rep['root_cause']} ({pct}% confidence). {len(rep['recommendations'])} recommended actions."
                    await emit("reply", {"text": reply})
                    await emit("result", {"agent": "rca", "data": result.data})
                else:
                    reply = result.summary + (f" — {result.warnings[0]}" if result.warnings else "")
                    await emit("reply", {"text": reply})

        elif intent == "onboarding":
            m = REPO_RE.search(message)
            if not m:
                reply = "Share a GitHub repo URL and I'll onboard it (or use the Onboarding console)."
                await emit("reply", {"text": reply})
            else:
                await emit("thinking", {"text": f"Scanning {m.group(0)}"})
                result = await _run_agent(OnboardingAgent(provider=provider), customer_id, {"repo_url": m.group(0)}, emit)
                rep = result.data.get("report", {})
                reply = f"Onboarded {rep.get('repo_name','repo')}: {len(rep.get('components', []))} components mapped. Context repo created."
                await emit("reply", {"text": reply})
                await emit("result", {"agent": "onboarding", "data": result.data})

        elif intent == "release":
            mode = "blocked" if re.search(r"block|fail|bad", message, re.I) else "healthy"
            await emit("thinking", {"text": "Running the release gate"})
            result = await _run_agent(ReleaseAgent(provider=provider), customer_id,
                                      {"service": "payment-service", "version": "v1.0.0", "demo_mode": mode}, emit)
            rep = result.data.get("report", {})
            reply = f"Release gate: {rep.get('deployment_status','?')} (rollback {'recommended' if rep.get('rollback_recommended') else 'not needed'})."
            await emit("reply", {"text": reply})
            await emit("result", {"agent": "release", "data": result.data})

        else:
            await emit("thinking", {"text": "Recalling what I know about your system"})
            reply = await _converse(customer_id, message, ws, provider)
            await emit("reply", {"text": reply})

    finally:
        if reply:
            memory.store(customer_id, "conversation", f"assistant: {reply}", thread_id=thread_id, importance=3)
