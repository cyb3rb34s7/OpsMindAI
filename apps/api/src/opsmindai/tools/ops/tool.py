"""Read-only operational tools for the conversational orchestrator (Mindy).

These let the agent answer "is X healthy / what's the pod status / show me logs"
directly, without running a full RCA. They are deterministic mocks (like the rest
of the infra layer) and scenario-aware: a degraded `mode` surfaces a failure tied
to the service's data store, which the agent reports — then offers to escalate to
RCA. The orchestrator checks and reports; it never tries to resolve. Resolution is
RCA's job.
"""
from __future__ import annotations

import hashlib

from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool

DEFAULT_REGIONS = ["us-east-1", "eu-west-1", "ap-south-1"]


def _stable_int(seed: str, lo: int, hi: int) -> int:
    """Deterministic pseudo-value so repeated checks look stable, not random."""
    h = int(hashlib.sha256(seed.encode()).hexdigest()[:8], 16)
    return lo + (h % (hi - lo + 1))


class ServiceStatusTool(BaseTool):
    name = "service_status"

    async def execute(self, payload: dict) -> ToolResult:
        target = payload.get("target") or "your services"
        regions = payload.get("regions") or DEFAULT_REGIONS
        mode = payload.get("mode", "healthy")
        store = payload.get("data_store") or "datastore"
        rows = []
        for i, r in enumerate(regions):
            base = _stable_int(f"{target}|{r}", 28, 85)
            if mode == "degraded" and i == 1:
                rows.append({"region": r, "status": "unhealthy", "latency_ms": base + 760,
                             "detail": f"readiness probe failing — {store} connection refused"})
            else:
                rows.append({"region": r, "status": "healthy", "latency_ms": base})
        healthy = sum(1 for x in rows if x["status"] == "healthy")
        return ToolResult(success=True, data={
            "service": target,
            "regions": rows,
            "healthy_regions": healthy,
            "total_regions": len(rows),
            "degraded": healthy < len(rows),
            "data_store": store,
        })


class PodStatusTool(BaseTool):
    name = "pod_status"

    async def execute(self, payload: dict) -> ToolResult:
        target = payload.get("target") or "workloads"
        mode = payload.get("mode", "healthy")
        store = payload.get("data_store") or "datastore"
        slug = str(target).replace(" ", "-")
        pods = []
        for i in range(3):
            name = f"{slug}-{_stable_int(f'{target}{i}', 10000, 99999)}-{_stable_int(f'{target}{i}x', 100, 999)}"
            if mode == "degraded" and i == 0:
                pods.append({"pod": name, "status": "CrashLoopBackOff", "restarts": 7, "ready": "0/1",
                             "detail": f"{store} connection refused on startup"})
            else:
                pods.append({"pod": name, "status": "Running", "restarts": 0, "ready": "1/1"})
        running = sum(1 for p in pods if p["status"] == "Running")
        return ToolResult(success=True, data={
            "service": target,
            "pods": pods,
            "running": running,
            "total": len(pods),
            "degraded": running < len(pods),
            "data_store": store,
        })


class TailServiceLogsTool(BaseTool):
    name = "tail_service_logs"

    async def execute(self, payload: dict) -> ToolResult:
        target = payload.get("target") or "service"
        mode = payload.get("mode", "healthy")
        store = payload.get("data_store") or "datastore"
        if mode == "degraded":
            lines = [
                f"[{target}] INFO  handling request batch (n={_stable_int(target, 20, 90)})",
                f"[{target}] WARN  {store} connection pool at 95% capacity",
                f"[{target}] ERROR readiness probe failed: dial {store}: connection refused",
                f"[{target}] ERROR restarting container after 3 failed health checks",
            ]
        else:
            lines = [
                f"[{target}] INFO  request served in {_stable_int(target, 8, 38)}ms",
                f"[{target}] INFO  connected to {store}, pool healthy",
                f"[{target}] INFO  readiness probe OK — serving traffic",
            ]
        return ToolResult(success=True, data={
            "service": target,
            "lines": lines,
            "has_errors": mode == "degraded",
            "data_store": store,
        })
