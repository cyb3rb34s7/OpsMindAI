"""Turn an RCA report into a reusable skill.

The skill's `failure_pattern` is the dedup key for the self-healing memory, so it
must be STABLE across runs — the same underlying incident has to produce the same
key, or every run creates a new 1× skill instead of reinforcing one. The LLM's
prose root-cause is phrased differently each time, so we distill a normalized
signature (service → dependency + failure type), e.g. "cartservice: redis
connection refused". That both dedups correctly and reads well as a playbook entry.
"""
from __future__ import annotations

import re

from opsmindai.agents.rca.schemas import RCAReport

# Known backing dependencies (longest/most-specific first).
_DEPS = [
    "postgresql", "postgres", "redis", "mysql", "mongodb", "mongo", "kafka",
    "rabbitmq", "dynamodb", "elasticsearch", "memcached", "cassandra", "database",
]

# Failure signatures: (regex, canonical label). First match wins.
_FAILS = [
    (r"connection refused|conn.*refused|cannot connect|could not.*connect|connection dropped|unreachable", "connection refused"),
    (r"time(?:d)? ?out|timeout", "timeout"),
    (r"exhaust|pool.*(?:full|capacity)|too many connections", "pool exhaustion"),
    (r"out of memory|\boom\b", "out of memory"),
    (r"crash ?loop", "crashloop"),
    (r"unavailable", "unavailable"),
    (r"permission|denied|unauthorized|forbidden", "auth failure"),
    (r"disk|no space", "disk full"),
]

_SERVICE_RE = re.compile(r"[a-z][a-z0-9-]*service", re.IGNORECASE)


def _signature(report: RCAReport) -> str:
    text = (report.root_cause or "").lower()
    m = _SERVICE_RE.search(text)
    if m:
        service = m.group(0)
    elif report.impacted_services:
        service = report.impacted_services[0].lower()
    else:
        service = "service"
    dep = next((d for d in _DEPS if d in text), "")
    fail = next((label for pat, label in _FAILS if re.search(pat, text)), "error")
    detail = f"{dep} {fail}".strip() if dep else fail
    return f"{service}: {detail}"


def extract_skill(report: RCAReport) -> dict:
    return {
        "failure_pattern": _signature(report),
        "resolution": report.recommendations[0] if report.recommendations else "investigate further",
        "success_score": report.confidence,
    }
