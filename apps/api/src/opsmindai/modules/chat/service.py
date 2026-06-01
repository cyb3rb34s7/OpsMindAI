"""The conversational orchestrator — "Mindy".

Mindy is the single front door for chat (web console + Telegram). She has an
identity, her own read-only DevOps tools (service status, pod status, logs), and
delegates to the specialist agents when a task needs one (RCA to investigate/resolve
an incident, Release to deploy, Onboarding to scan a repo).

Boundary: Mindy *checks and reports* — she never tries to resolve an error. When a
check surfaces a problem she offers to escalate to RCA. Resolution is RCA's job.
"""
from __future__ import annotations

import asyncio
import json
import re
from typing import Awaitable, Callable

from pydantic import BaseModel

from opsmindai.agents.base.schemas import ExecutionContext
from opsmindai.agents.cognition.schemas import RouteDecision
from opsmindai.agents.onboarding.agent import OnboardingAgent
from opsmindai.agents.rca.agent import RCAAgent
from opsmindai.agents.release.agent import ReleaseAgent
from opsmindai.modules.memory.service import memory
from opsmindai.modules.onboarding.cache import get_customer_report
from opsmindai.shared.llm.base.models import LLMRequest
from opsmindai.shared.llm.client import LLMClient
from opsmindai.shared.trace import generate_trace_id
from opsmindai.tools.ops.tool import PodStatusTool, ServiceStatusTool, TailServiceLogsTool

Emit = Callable[[str, dict], Awaitable[None]]

TRACE_RE = re.compile(r"trace_\w+", re.IGNORECASE)
REPO_RE = re.compile(r"https?://github\.com/[^\s]+", re.IGNORECASE)
SERVICE_RE = re.compile(r"\b([a-z][a-z0-9-]*service|[a-z][a-z0-9-]*-service)\b", re.IGNORECASE)

CHAT_ROUTER_PROMPT = """You route a DevOps engineer's message to one intent:
- status: checking service health / is X up / latency / "are things ok"
- pods: pod / replica / crashloop / restart status
- logs: show or tail a service's logs
- rca: explicitly investigate, diagnose, root-cause, or FIX an incident (or a trace id)
- release: deploying, releasing, rolling back
- onboarding: onboarding or scanning a repository
- general: architecture/history/chit-chat answerable from memory
Return intent, confidence (0-1), and a one-sentence reasoning."""

# Mindy's voice, used for the general / from-memory replies.
MINDY_SYSTEM_PROMPT = """You are Mindy, OpsMindAI's DevOps agent — a sharp, upbeat on-call
engineer who's genuinely glad to help. You know this customer's system from the MEMORY
below (their services, architecture, past incidents, learned skills).

Reply in a warm, concise, conversational way (1-4 short sentences). A tasteful emoji is
fine. Never output JSON, key/value dumps, or code fences (an inline command is ok). If
the memory doesn't cover something, say what you'd need rather than inventing details."""

GREETING_REPLY = (
    "Hey! 👋 I'm Mindy, your DevOps agent. I can check service health, pods and logs, "
    "run releases, or investigate incidents. What can I do for you?"
)

# ---- routing ---------------------------------------------------------------

_GREETING_RE = re.compile(r"^\s*(hi|hey|hello|yo|sup|gm|good (morning|evening)|thanks|thank you|ok|okay|cool|nice|got it|howdy|who are you|what can you do)\b[\s!.?]*$", re.IGNORECASE)
# A declarative statement teaching Mindy something (not a command/question). These
# go to conversation so she acknowledges + learns — never to a deploy/status action,
# even when they happen to contain words like "deploy". No trailing '?' (questions
# are handled by the intent routes below).
_DECLARATIVE_RE = re.compile(
    r"^\s*(just so you know|fyi|for the record|remember|note that|keep in mind|for future|don'?t forget|heads up[,: ]+(we|our))\b"
    r"|^\s*(we|our|i|my)\b[^?]*\b(deploy|use|using|run|running|prefer|preferred|store|stored|host|hosted|on-?call|sla|window|policy|standard|convention|team|owns?)\b[^?]*$",
    re.IGNORECASE,
)
_INVESTIGATE_RE = re.compile(r"\b(investigat\w*|diagnos\w*|root[\s-]?cause|\brca\b|debug|troubleshoot|why (is|are|did|does|was)|what('?s| is| was) wrong|what went wrong|fix|resolve|mitigat\w*)\b", re.IGNORECASE)
_RELEASE_RE = re.compile(r"\b(deploy|release|roll ?back|rollout|ship it|ship to|promote)\b", re.IGNORECASE)
_PODS_RE = re.compile(r"\b(pods?|replicas?|crash ?loop\w*|restart\w*|kubectl|deployment status)\b", re.IGNORECASE)
_LOGS_RE = re.compile(r"\b(logs?|tail|stderr|stdout|stack ?trace|log lines?)\b", re.IGNORECASE)
_STATUS_RE = re.compile(r"\b(health\w*|status|uptime|latency|reachable|alive|is .* (up|down|ok|running)|are .* (up|down|ok|running|healthy)|everything (ok|fine|good|alright)|check (the )?(service|server|health|status|system))\b", re.IGNORECASE)
_FAILURE_RE = re.compile(r"\b(down|failing|failed|fail|error\w*|500s?|crash\w*|broken|throwing|outage|degraded|unhealthy|not working|timing out|timeouts?)\b", re.IGNORECASE)
_GENERAL_RE = re.compile(r"\b(architecture|stack|components|dependenc\w*|risks?|overview|what('?s| is| are)|how many|when|which|list|explain|tell me about|who owns|history)\b", re.IGNORECASE)
# A question (not an imperative). Deploy/release words inside a question are
# informational ("when do we deploy?") — answer from memory, don't run a release.
_QUESTION_RE = re.compile(r"\?\s*$|^\s*(when|what|whats|how|who|where|why|do|does|did|can|could|should|will)\b", re.IGNORECASE)


def _fast_route(message: str) -> dict | None:
    """Deterministic routing for clear messages; None when genuinely ambiguous.
    Order matters: explicit investigation/deploy win, then read-only ops checks,
    then general. Symptom language (a service is 'down'/'failing') is a *status
    check* — Mindy looks, reports, and offers RCA — not an immediate RCA."""
    if TRACE_RE.search(message):
        return {"intent": "rca", "confidence": 0.95, "reasoning": "Detected a trace id."}
    if REPO_RE.search(message):
        return {"intent": "onboarding", "confidence": 0.95, "reasoning": "Detected a GitHub URL."}
    if _GREETING_RE.match(message):
        return {"intent": "general", "confidence": 0.95, "reasoning": "Greeting / small talk."}
    if _DECLARATIVE_RE.search(message):
        return {"intent": "general", "confidence": 0.85, "reasoning": "Declarative statement — converse and learn."}
    if _INVESTIGATE_RE.search(message):
        return {"intent": "rca", "confidence": 0.9, "reasoning": "Explicit investigate/fix request."}
    if _RELEASE_RE.search(message) and not _QUESTION_RE.search(message):
        return {"intent": "release", "confidence": 0.85, "reasoning": "Deploy/release command."}
    if _PODS_RE.search(message):
        return {"intent": "pods", "confidence": 0.85, "reasoning": "Pod/replica check."}
    if _LOGS_RE.search(message):
        return {"intent": "logs", "confidence": 0.85, "reasoning": "Log tail request."}
    if _STATUS_RE.search(message) or _FAILURE_RE.search(message):
        return {"intent": "status", "confidence": 0.8, "reasoning": "Service health/status check."}
    if _GENERAL_RE.search(message) or _QUESTION_RE.search(message):
        return {"intent": "general", "confidence": 0.75, "reasoning": "Informational — answer from memory."}
    return None


async def _route(message: str, provider: str | None) -> dict:
    fast = _fast_route(message)
    if fast is not None:
        return fast
    client = LLMClient(provider=provider)
    req = LLMRequest(system_prompt=CHAT_ROUTER_PROMPT, user_prompt=message, response_schema=RouteDecision, max_tokens=300)
    try:
        resp = await client.generate(req)
        return RouteDecision.model_validate(resp.structured_output).model_dump()
    except Exception:
        return {"intent": "general", "confidence": 0.6, "reasoning": "Answering from memory."}


# ---- ops context + scenario -----------------------------------------------

_INCIDENT_RE = re.compile(r"\b(cart|redis|fail\w*|error\w*|500s?|down|crash\w*|broken|throwing|degraded|unhealthy|outage|issue|problem)\b", re.IGNORECASE)


def _ops_context(customer_id: str, message: str) -> tuple[list[str], str | None, str]:
    """Resolve (known services, the target service in the message, its data store)
    from the onboarded context repo, so ops answers reference the real system."""
    report = get_customer_report(customer_id) or {}
    components = report.get("components", [])
    services = [s for s in (report.get("services") or [c.get("name", "") for c in components]) if s]
    target = None
    ml = message.lower()
    for s in services:
        if s.lower() in ml:
            target = s
            break
    if target is None:
        m = SERVICE_RE.search(message)
        target = m.group(1) if m else None
    match = next((c for c in components if target and target.lower() in c.get("name", "").lower()), None)
    store = (match or (components[0] if components else {})).get("data_store") or "Redis"
    return services, target, store


def _ops_mode(message: str, target: str | None) -> str:
    """Scenario-aware: degraded if the message implies trouble, or the target is the
    demo's incident service (cart → Redis). Otherwise healthy."""
    if _INCIDENT_RE.search(message):
        return "degraded"
    if target and "cart" in target.lower():
        return "degraded"
    return "healthy"


# ---- Mindy's templated voice for tool results ------------------------------

def _say_status(d: dict) -> str:
    svc, h, t = d["service"], d["healthy_regions"], d["total_regions"]
    avg = round(sum(r["latency_ms"] for r in d["regions"]) / max(1, t))
    if not d["degraded"]:
        return f"✅ {svc} is healthy — {h}/{t} regions up, latency ~{avg}ms. Anything else I can check?"
    bad = next(r for r in d["regions"] if r["status"] != "healthy")
    return (f"⚠️ Heads up — {svc} is degraded. {bad['region']} is failing its readiness probe "
            f"({bad.get('detail', 'unhealthy')}); the other regions are fine. "
            f"I can run a full root-cause investigation if you'd like — just say the word. 🔍")


def _say_pods(d: dict) -> str:
    svc, r, t = d["service"], d["running"], d["total"]
    if not d["degraded"]:
        return f"✅ {svc} pods look good — {r}/{t} Running, no restarts."
    bad = next(p for p in d["pods"] if p["status"] != "Running")
    return (f"⚠️ {svc} has a pod in {bad['status']} ({bad['restarts']} restarts — {bad.get('detail', '')}). "
            f"{r}/{t} are healthy. Want me to dig into the root cause? 🔍")


def _say_logs(d: dict) -> str:
    body = "\n".join(d["lines"])
    if not d["has_errors"]:
        return f"Here are the latest {d['service']} logs:\n{body}\n\nAll clean — nothing alarming. ✅"
    return (f"Here are the latest {d['service']} logs:\n{body}\n\n"
            f"I can see {d['data_store']} connection errors in there. I won't patch it blind — "
            f"want me to run a proper RCA on this? 🔍")


def _unwrap_reply(text: str) -> str:
    """Small local models sometimes wrap prose in a ```json fence or a
    {"response": "..."} object despite instructions — unwrap to clean prose."""
    t = (text or "").strip()
    fence = re.match(r"^```(?:json|markdown)?\s*(.*?)\s*```$", t, re.DOTALL)
    if fence:
        t = fence.group(1).strip()
    if t.startswith("{") and t.endswith("}"):
        try:
            obj = json.loads(t)
            if isinstance(obj, dict):
                for k in ("response", "reply", "text", "message", "answer", "content"):
                    if isinstance(obj.get(k), str):
                        return obj[k].strip()
                for v in obj.values():
                    if isinstance(v, str):
                        return v.strip()
        except (ValueError, TypeError):
            pass
    return t


async def _converse(customer_id: str, message: str, ws: dict, provider: str | None) -> str:
    client = LLMClient(provider=provider)
    system = f"{MINDY_SYSTEM_PROMPT}\n\n# MEMORY\n{ws['prompt_block'] or '(no memory yet)'}"
    # Small local models occasionally return empty content; retry once before
    # giving up so the user never sees a blank reply.
    for _ in range(2):
        resp = await client.generate(LLMRequest(system_prompt=system, user_prompt=message, max_tokens=500))
        text = _unwrap_reply(resp.content or "")
        if text:
            return text
    return ""


# ---- self-learning: Mindy distils durable org facts from conversations ------

class _LearnedFacts(BaseModel):
    facts: list[str] = []


REFLECT_PROMPT = """You maintain the long-term org memory for a DevOps agent. From this
exchange, extract durable, reusable facts worth remembering to serve this user better
later: their services/architecture, ownership, environments & regions, schedules
(deploy windows, on-call), SLAs, conventions, tooling, and explicit preferences.

Rules: only durable, specific facts a teammate would write down — never questions,
greetings, transient status, or generic knowledge. Phrase each as a short standalone
statement (e.g. "Deploys happen Fridays at 6pm IST"). Return an empty list if there is
nothing worth remembering."""

# Gate so we only spend a reflection call when the user is actually telling Mindy
# something (a statement about their org/prefs), not asking a question or greeting.
_TEACH_RE = re.compile(
    r"\b(we|our|us|my|i)\b[^.?!]*\b(use|using|run|running|deploy|prefer|preferred|own|owns|owned|have|has|on-?call|sla|window|policy|standard|convention|always|never|store|stored|host|hosted|region|team|prod|production|staging)\b"
    r"|\b(remember|note that|keep in mind|for future|fyi|just so you know|don'?t forget)\b",
    re.IGNORECASE,
)


async def _reflect(customer_id: str, message: str, reply: str, emit: Emit, provider: str | None) -> None:
    """After replying, learn durable facts from the exchange (gated + best-effort)."""
    # Only reflect on statements that teach something — not questions or commands.
    if _QUESTION_RE.search(message or "") or not _TEACH_RE.search(message or ""):
        return
    client = LLMClient(provider=provider)
    req = LLMRequest(
        system_prompt=REFLECT_PROMPT,
        user_prompt=f"User: {message}\nMindy: {reply}",
        response_schema=_LearnedFacts,
        max_tokens=300,
    )
    try:
        resp = await client.generate(req)
        facts = _LearnedFacts.model_validate(resp.structured_output).facts
    except Exception:
        return
    stored = [f.strip() for f in facts if f and f.strip()
              and memory.store(customer_id, "fact", f.strip(), importance=7)]
    if stored:
        await emit("learned", {"facts": stored})


async def _run_agent(agent, customer_id: str, payload: dict, emit: Emit):
    ctx = ExecutionContext(
        trace_id=generate_trace_id(),
        customer_id=customer_id,
        agent_run_id=f"chat_{generate_trace_id()}",
        emit=emit,
    )
    return await agent.run(ctx, payload)


# ---- ops handler -----------------------------------------------------------

# Deliberate pacing so the steps reveal one-by-one (thinking → checking → result)
# instead of flashing all at once and feeling scripted. Same cadence every time.
STEP_PAUSE = 0.7

OPS_SYNTH_PROMPT = """You are Mindy, a friendly, upbeat DevOps agent. Rephrase the
status finding below in your own warm, natural voice (1-3 short sentences). Keep every
fact (service, regions/pods, numbers, the failing region and reason) and keep the offer
to run a root-cause investigation if it's present — never propose a fix yourself.
Plain conversational prose, no JSON or code fences; a tasteful emoji is fine."""


async def _ops_synth(summary: str, provider: str | None) -> str:
    """Let the AI phrase the reply in Mindy's voice from the grounded factual summary
    of the (deterministic) tool data — so the answer is genuinely reasoned and varied,
    not a fixed template. Retries once; empty falls back to the summary itself."""
    client = LLMClient(provider=provider)
    for _ in range(2):
        try:
            resp = await client.generate(LLMRequest(system_prompt=OPS_SYNTH_PROMPT, user_prompt=summary, max_tokens=300))
            text = _unwrap_reply(resp.content or "")
            if text:
                return text
        except Exception:
            break
    return ""


async def _handle_ops(intent: str, customer_id: str, message: str, emit: Emit, provider: str | None) -> str:
    services, target, store = _ops_context(customer_id, message)
    mode = _ops_mode(message, target)
    label = target or "your services"
    tools = {
        "status": (ServiceStatusTool, "service status", _say_status),
        "pods": (PodStatusTool, "pod status", _say_pods),
        "logs": (TailServiceLogsTool, "tail logs", _say_logs),
    }
    tool_cls, verb, render = tools[intent]
    name = f"{verb} · {label}"
    # Steps revealed one at a time, even though the data is ready instantly.
    await emit("thinking", {"text": f"Checking {verb} for {label}…"})
    await asyncio.sleep(STEP_PAUSE)
    await emit("tool", {"name": name, "status": "running"})
    res = await tool_cls().execute({"target": target or "your services", "mode": mode, "data_store": store})
    bad = res.data.get("degraded") or res.data.get("has_errors")
    await asyncio.sleep(STEP_PAUSE)
    await emit("tool", {"name": name, "status": "done", "summary": "degraded" if bad else "healthy"})
    await asyncio.sleep(STEP_PAUSE)
    await emit("thinking", {"text": "Reading the result and writing it up…"})
    # The template is the grounded factual summary; the AI rephrases it in Mindy's
    # voice (genuinely reasoned, varied), falling back to the summary if the model fails.
    summary = render(res.data)
    return await _ops_synth(summary, provider) or summary


# ---- the turn --------------------------------------------------------------

async def run_turn(customer_id: str, thread_id: str, message: str, emit: Emit, provider: str | None = None) -> None:
    memory.store(customer_id, "conversation", f"user: {message}", thread_id=thread_id, importance=3)
    ws = memory.build_working_set(customer_id, thread_id, message)
    await emit("memory", {"used": ws["used"]})

    route = await _route(message, provider)
    await emit("routing", route)
    intent = route.get("intent", "general")

    reply = ""
    try:
        if intent in ("status", "pods", "logs"):
            reply = await _handle_ops(intent, customer_id, message, emit, provider)
            await emit("reply", {"text": reply})

        elif intent == "rca":
            m = TRACE_RE.search(message)
            if not m:
                _, target, _ = _ops_context(customer_id, message)
                svc = target or "the service"
                reply = (f"I'll dig in 🔍 — do you have a trace ID for me, or should I pull the latest "
                         f"error logs for {svc} to start?")
                await emit("reply", {"text": reply})
            else:
                result = await _run_agent(RCAAgent(provider=provider), customer_id,
                                          {"trace_id": m.group(0), "description": message,
                                           "incident_id": f"CHAT-{m.group(0)}"}, emit)
                if result.success:
                    rep = result.data["report"]
                    pct = round(rep["confidence"] * 100)
                    # Surface the self-healing skill memory so it's visible in chat:
                    # reused a prior skill, or saved a new one for next time.
                    applied = result.data.get("applied_skills") or []
                    learned = result.data.get("learned_skill") or {}
                    seen = learned.get("success_count", 1)
                    if applied:
                        skill_note = f" 🧠 I'd seen this pattern before — reused a learned skill (now confirmed {seen}× for you)."
                    else:
                        skill_note = " 🧠 I've saved this as a reusable skill, so next time I'll recognize it instantly."
                    reply = (f"On it 🔍 Investigated {m.group(0)} — root cause: {rep['root_cause']} "
                             f"({pct}% confidence).{skill_note} I've got {len(rep['recommendations'])} recommended fixes; want the details?")
                    await emit("reply", {"text": reply})
                    await emit("result", {"agent": "rca", "data": result.data})
                else:
                    reply = result.summary + (f" — {result.warnings[0]}" if result.warnings else "")
                    await emit("reply", {"text": reply})

        elif intent == "onboarding":
            m = REPO_RE.search(message)
            if not m:
                reply = "Share a GitHub repo URL and I'll onboard it for you (or use the Onboarding console)."
                await emit("reply", {"text": reply})
            else:
                await emit("thinking", {"text": f"Scanning {m.group(0)}"})
                result = await _run_agent(OnboardingAgent(provider=provider), customer_id, {"repo_url": m.group(0)}, emit)
                rep = result.data.get("report", {})
                reply = f"Done ✅ Onboarded {rep.get('repo_name', 'the repo')} — mapped {len(rep.get('components', []))} components into your context repo."
                await emit("reply", {"text": reply})
                await emit("result", {"agent": "onboarding", "data": result.data})

        elif intent == "release":
            if re.search(r"block|misconfig|security", message, re.I):
                mode = "blocked"
            elif re.search(r"degrad|fail|partial|broken", message, re.I):
                mode = "degraded"
            else:
                mode = "healthy"
            svc_match = SERVICE_RE.search(message)
            service = svc_match.group(0) if svc_match else "payment-service"
            result = await _run_agent(ReleaseAgent(provider=provider), customer_id,
                                      {"service": service, "version": "v1.4.0", "demo_mode": mode}, emit)
            rep = result.data.get("report", {})
            healthy = sum(1 for r in rep.get("regions", []) if r.get("status") == "deployed")
            total = len(rep.get("regions", []))
            status = rep.get("deployment_status", "?")
            tail = " Failed regions were rolled back." if rep.get("rollback_recommended") else ""
            reply = (f"🚀 Release {status} — {healthy}/{total} regions healthy.{tail}" if total
                     else f"🚀 Release {status}.")
            await emit("reply", {"text": reply})
            await emit("result", {"agent": "release", "data": result.data})

        else:  # general
            if _GREETING_RE.match(message):
                reply = GREETING_REPLY
                await emit("reply", {"text": reply})
            else:
                await emit("thinking", {"text": "Recalling what I know about your system"})
                reply = await _converse(customer_id, message, ws, provider)
                if not reply:
                    reply = "I'm here — ask me to check a service's health, tail logs, run a release, or investigate an incident."
                await emit("reply", {"text": reply})

    finally:
        if reply:
            memory.store(customer_id, "conversation", f"assistant: {reply}", thread_id=thread_id, importance=3)

    # Self-learning happens after the reply is already on screen, so it never adds
    # latency the user feels (the web stream shows a 'learned' chip; Telegram has
    # already sent the reply on the reply event).
    await _reflect(customer_id, message, reply, emit, provider)
