from __future__ import annotations

import asyncio
from uuid import uuid4

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.release.report_generator import ReleaseReportWriter
from opsmindai.agents.release.schemas import RegionResult, ReleaseReport
from opsmindai.modules.onboarding.cache import get_customer_report
from opsmindai.tools.aws.tool import ValidateAwsConfigTool

DEFAULT_REGIONS = ["us-east-1", "eu-west-1", "ap-south-1"]

# Step pacing so the streamed rollout is watchable (mock infra is instant).
# Each phase shows a loader for the base duration, then regions complete one at a
# time STAGGER_S apart so the rollout cascades instead of snapping all at once.
PRE_DEPLOY_S = 2.4
DEPLOY_S = 2.4
STARTUP_S = 2.2
SANITY_S = 1.8
STAGGER_S = 0.7


def _system_context(customer_id: str, service: str) -> dict:
    """Pull the onboarded system's services + the deployed service's dependencies
    from the context repo, so checks/logs reference real infrastructure."""
    report = get_customer_report(customer_id) or {}
    components = report.get("components", [])
    services = report.get("services", []) or [c.get("name") for c in components]
    match = next((c for c in components if c.get("name", "").lower() == service.lower()), None)
    if match is None:
        match = next((c for c in components if service.lower() in c.get("name", "").lower()), None)
    data_store = (match or {}).get("data_store", "") or "datastore"
    deps = (match or {}).get("dependencies", [])
    return {
        "system": report.get("repo_name", ""),
        "services": services,
        "data_store": data_store,
        "dependencies": deps,
    }


class ReleaseAgent(BaseAgent):
    """Multi-region release bot: pre-deploy gate → deploy all regions → verify
    startup logs → run sanity scripts → publish a release report. Reads the
    context repo to deploy the real service with its real dependencies. Streams
    each phase. demo_mode: healthy | blocked | degraded."""

    name = "release"

    def __init__(self, provider: str | None = None):
        super().__init__()
        self.provider = provider
        self.aws_tool = ValidateAwsConfigTool()
        self.report_writer = ReleaseReportWriter()

    async def execute(self, context: ExecutionContext, payload: dict) -> AgentResult:
        service = payload.get("service", "payment-service")
        version = payload.get("version", "v1.0.0")
        regions = payload.get("regions") or DEFAULT_REGIONS
        mode = payload.get("demo_mode", "healthy")
        ctx = _system_context(context.customer_id, service)
        store = ctx["data_store"]

        # 1. Pre-deploy gate.
        await context.send("thinking", text=f"Pre-deploy checks for {service} {version}" + (f" ({ctx['system']})" if ctx["system"] else ""))
        await context.send("tool", name="pre-deploy checks", status="running")
        await asyncio.sleep(PRE_DEPLOY_S)
        aws = await self.aws_tool.execute({"demo_mode": "blocked" if mode == "blocked" else "healthy"})
        infra_warnings = aws.data.get("findings", [])
        passed = aws.data.get("valid", True)
        await context.send("tool", name="pre-deploy checks", status="done",
                           summary="passed" if passed else "BLOCKED: " + "; ".join(infra_warnings))

        if not passed:
            report = ReleaseReport(
                service=service, version=version, deployment_status="blocked",
                infra_warnings=infra_warnings, rollback_recommended=True,
                changelog=[f"{service} {version} blocked at pre-deploy — no regions deployed"],
                startup_health="not started",
            )
            report.artifact_path = self.report_writer.generate(f"blocked_{uuid4().hex[:6]}", report)
            return AgentResult(success=True, summary="Release blocked at pre-deploy", data={"report": report.model_dump()}, warnings=infra_warnings)

        failing_region = "eu-west-1" if mode == "degraded" else None
        deploy_ids = {r: f"deploy_{uuid4().hex[:8]}" for r in regions}
        logs: dict[str, list[str]] = {r: [] for r in regions}

        # 2. Deploy phase — all regions in parallel.
        await context.send("thinking", text=f"Deploying {service}:{version} to {len(regions)} regions")
        for r in regions:
            await context.send("tool", name=f"deploy {r}", status="running")
        await asyncio.sleep(DEPLOY_S)
        for i, r in enumerate(regions):
            if i:
                await asyncio.sleep(STAGGER_S)
            logs[r] += [
                f"[{r}] Triggering Jenkins pipeline release-{service} (build {deploy_ids[r]})",
                f"[{r}] Pulling image {service}:{version}",
                f"[{r}] Applying k8s manifests to cluster {r}",
                f"[{r}] Rollout started",
            ]
            await context.send("tool", name=f"deploy {r}", status="done", summary=deploy_ids[r])

        # 3. Startup phase.
        for r in regions:
            await context.send("tool", name=f"startup {r}", status="running")
        await asyncio.sleep(STARTUP_S)
        startup: dict[str, str] = {}
        for i, r in enumerate(regions):
            if i:
                await asyncio.sleep(STAGGER_S)
            fail = r == failing_region
            if fail:
                startup[r] = "failed"
                logs[r] += [
                    f"[{r}] {service} container starting…",
                    f"[{r}] ERROR readiness probe failed: dial {store} connect: connection refused",
                    f"[{r}] CrashLoopBackOff after 3 restarts — startup aborted",
                ]
            else:
                startup[r] = "healthy"
                logs[r] += [
                    f"[{r}] {service} container starting…",
                    f"[{r}] connected to {store}, migrations up to date",
                    f"[{r}] readiness probe OK — now serving traffic",
                ]
            await context.send("tool", name=f"startup {r}", status="done", summary=startup[r])

        # 4. Sanity phase.
        for r in regions:
            await context.send("tool", name=f"sanity {r}", status="running")
        await asyncio.sleep(SANITY_S)
        results: list[RegionResult] = []
        for i, r in enumerate(regions):
            if i:
                await asyncio.sleep(STAGGER_S)
            fail = r == failing_region
            sanity = [
                {"name": "health endpoint reachable", "ok": True},
                {"name": f"{store} connectivity", "ok": not fail},
                {"name": "db connectivity", "ok": True},
            ]
            sanity_ok = all(c["ok"] for c in sanity)
            await context.send("tool", name=f"sanity {r}", status="done", summary="pass" if sanity_ok else "fail")
            region_ok = startup[r] == "healthy" and sanity_ok
            if not region_ok:
                logs[r].append(f"[{r}] Health gate failed — rolling back this region")
            results.append(RegionResult(
                region=r, status="deployed" if region_ok else "failed",
                deployment_id=deploy_ids[r], startup_health=startup[r],
                sanity_passed=sanity_ok, sanity=sanity, logs=logs[r],
            ))

        failed = [x for x in results if x.status != "deployed"]
        overall = "released" if not failed else "partial"
        await context.send("thinking", text=f"Release {overall}: {len(results) - len(failed)}/{len(results)} regions healthy")

        report = ReleaseReport(
            service=service, version=version, deployment_status=overall,
            regions=results, infra_warnings=infra_warnings,
            rollback_recommended=bool(failed),
            changelog=[
                f"Deployed {service} {version} to {len(results) - len(failed)}/{len(results)} regions"
                + (f" of {ctx['system']}" if ctx["system"] else ""),
                *([f"Rolled back {x.region}: startup/sanity failed on {store}" for x in failed]),
            ],
            startup_health="healthy" if not failed else "degraded",
            sanity_results=[f"{x.region}: {'pass' if x.sanity_passed else 'fail'}" for x in results],
            warnings=[f"{x.region} failed startup/sanity" for x in failed],
        )
        report.artifact_path = self.report_writer.generate(results[0].deployment_id if results else "release", report)

        return AgentResult(
            success=True,
            summary=f"Release {overall} — {len(results) - len(failed)}/{len(results)} regions healthy",
            data={"report": report.model_dump()},
            warnings=report.warnings,
        )
