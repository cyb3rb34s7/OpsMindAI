from __future__ import annotations

from uuid import uuid4

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.release.report_generator import ReleaseReportWriter
from opsmindai.agents.release.schemas import RegionResult, ReleaseReport
from opsmindai.tools.aws.tool import ValidateAwsConfigTool

DEFAULT_REGIONS = ["us-east-1", "eu-west-1", "ap-south-1"]


def _build_logs(service: str, version: str, region: str, deploy_id: str) -> list[str]:
    return [
        f"[{region}] Triggering Jenkins pipeline release-{service} (build {deploy_id})",
        f"[{region}] Pulling image {service}:{version}",
        f"[{region}] Applying k8s manifests to cluster {region}",
        f"[{region}] Rollout started",
    ]


def _startup_logs(service: str, region: str, failing: bool) -> tuple[str, list[str]]:
    if failing:
        return "failed", [
            f"[{region}] {service} container starting…",
            f"[{region}] ERROR readiness probe failed: dial tcp :8080 connect: connection refused",
            f"[{region}] CrashLoopBackOff after 3 restarts — startup aborted",
        ]
    return "healthy", [
        f"[{region}] {service} container starting…",
        f"[{region}] connected to datastore, migrations up to date",
        f"[{region}] readiness probe OK — now serving traffic",
    ]


def _sanity(failing: bool) -> list[dict]:
    return [
        {"name": "health endpoint reachable", "ok": True},
        {"name": "redis connectivity", "ok": not failing},
        {"name": "db connectivity", "ok": True},
    ]


class ReleaseAgent(BaseAgent):
    """Multi-region release bot: pre-deploy gate -> per-region deploy + startup +
    sanity (streamed step-by-step) -> consolidated release report.

    Orchestration is deterministic (a release is a pipeline, not a guess); the
    infra calls are mocked. demo_mode: healthy | blocked | degraded.
    """

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

        # 1. Pre-deploy gate.
        await context.send("thinking", text=f"Running pre-deploy checks for {service} {version}")
        await context.send("tool", name="pre_deploy_checks", status="running")
        aws = await self.aws_tool.execute({"demo_mode": "blocked" if mode == "blocked" else "healthy"})
        infra_warnings = aws.data.get("findings", [])
        passed = aws.data.get("valid", True)
        await context.send(
            "tool", name="pre_deploy_checks", status="done",
            summary="passed" if passed else "BLOCKED: " + "; ".join(infra_warnings),
        )

        if not passed:
            report = ReleaseReport(
                service=service, version=version, deployment_status="blocked",
                infra_warnings=infra_warnings, rollback_recommended=True,
                changelog=[f"{service} {version} (blocked at pre-deploy)"],
                startup_health="not started", sanity_results=[],
            )
            report.artifact_path = self.report_writer.generate(f"blocked_{uuid4().hex[:6]}", report)
            return AgentResult(success=True, summary="Release blocked at pre-deploy checks", data={"report": report.model_dump()}, warnings=infra_warnings)

        # 2. Roll out region by region.
        results: list[RegionResult] = []
        for region in regions:
            failing = mode == "degraded" and region == "eu-west-1"
            deploy_id = f"deploy_{uuid4().hex[:8]}"

            await context.send("tool", name=f"deploy {region}", status="running")
            logs = _build_logs(service, version, region, deploy_id)
            await context.send("tool", name=f"deploy {region}", status="done", summary=deploy_id)

            await context.send("tool", name=f"startup {region}", status="running")
            startup_status, startup_logs = _startup_logs(service, region, failing)
            logs += startup_logs
            await context.send("tool", name=f"startup {region}", status="done", summary=startup_status)

            await context.send("tool", name=f"sanity {region}", status="running")
            sanity = _sanity(failing)
            sanity_ok = all(c["ok"] for c in sanity)
            await context.send("tool", name=f"sanity {region}", status="done", summary="pass" if sanity_ok else "fail")

            region_ok = startup_status == "healthy" and sanity_ok
            if not region_ok:
                logs.append(f"[{region}] Health gate failed — rolling back this region")
            results.append(RegionResult(
                region=region, status="deployed" if region_ok else "failed",
                deployment_id=deploy_id, startup_health=startup_status,
                sanity_passed=sanity_ok, sanity=sanity, logs=logs,
            ))

        failed = [r for r in results if r.status != "deployed"]
        overall = "released" if not failed else "partial"
        await context.send("thinking", text=f"Release {overall}: {len(results) - len(failed)}/{len(results)} regions healthy")

        report = ReleaseReport(
            service=service, version=version, deployment_status=overall,
            regions=results, infra_warnings=infra_warnings,
            rollback_recommended=bool(failed),
            changelog=[
                f"Deployed {service} {version} to {len(results) - len(failed)}/{len(results)} regions",
                *([f"Rolled back {r.region} (startup/sanity failed)" for r in failed]),
            ],
            startup_health="healthy" if not failed else "degraded",
            sanity_results=[f"{r.region}: {'pass' if r.sanity_passed else 'fail'}" for r in results],
            warnings=[f"{r.region} failed startup/sanity" for r in failed],
        )
        report.artifact_path = self.report_writer.generate(results[0].deployment_id if results else "release", report)

        return AgentResult(
            success=True,
            summary=f"Release {overall} — {len(results) - len(failed)}/{len(results)} regions healthy",
            data={"report": report.model_dump()},
            warnings=report.warnings,
        )
