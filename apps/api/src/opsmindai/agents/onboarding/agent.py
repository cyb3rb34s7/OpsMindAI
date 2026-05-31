from __future__ import annotations

import json

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.onboarding.analyzer import build_onboarding_context
from opsmindai.agents.onboarding.context_repo import ContextRepoGenerator
from opsmindai.agents.onboarding.schemas import OnboardingReport
from opsmindai.agents.prompts import ONBOARDING_SYSTEM_PROMPT
from opsmindai.modules.memory.service import memory
from opsmindai.modules.onboarding.cache import context_hash, get_cached, get_repo_report, put_cached
from opsmindai.runtime.runner import CognitiveRunner
from opsmindai.tools.github.schemas import RepositoryScanResult
from opsmindai.tools.github.tool import GitHubScannerTool


class OnboardingAgent(BaseAgent):
    name = "onboarding"

    def __init__(self, provider: str | None = None):
        super().__init__()
        self.provider = provider
        self.scanner = GitHubScannerTool()
        self.context_repo = ContextRepoGenerator()

    async def execute(self, context: ExecutionContext, payload: dict) -> AgentResult:
        repo_url = payload.get("repo_url")
        if not repo_url:
            return AgentResult(
                success=False,
                summary="repo_url is required",
                data={},
                warnings=["repo_url missing"],
            )

        # Cache: identical (repo + pasted context) returns instantly. The demo
        # runs on one repo, so this keeps replays fast and deterministic.
        chash = context_hash(payload)
        if not payload.get("force_refresh"):
            cached = get_cached(context.customer_id, repo_url, chash)
            if cached is not None:
                return AgentResult(
                    success=True,
                    summary="Repository onboarding (cached)",
                    data={**cached, "cached": True},
                    warnings=cached.get("report", {}).get("warnings", []),
                )

        # Golden report: reuse a prior successful analysis of this repo (any
        # tenant) so a fresh tenant gets instant, reliable onboarding without a
        # throttle-prone live LLM call. The per-customer context repo + memory
        # below still run live.
        model_used = "cache"
        golden = None if payload.get("force_refresh") else get_repo_report(repo_url)
        if golden is not None:
            report = OnboardingReport.model_validate(golden)
            report.warnings = [*report.warnings, "Reused a cached analysis of this repository."]
        else:
            scan_result = await self.scanner.execute(
                {"repo_url": repo_url, "customer_id": context.customer_id}
            )
            if not scan_result.success:
                return AgentResult(
                    success=False,
                    summary="Repository scan failed",
                    data=scan_result.data,
                    warnings=[scan_result.error or "scan failed"],
                )

            scan_ctx = build_onboarding_context(
                RepositoryScanResult.model_validate(scan_result.data)
            )
            provided_context = {
                "decision_records": payload.get("decisions", ""),
                "transcripts": payload.get("transcripts", ""),
                "business_context": payload.get("business_context", ""),
                "extra_docs": payload.get("extra_docs", ""),
            }
            # Pure synthesis over the scan; skip the tool loop (one LLM call).
            runner = CognitiveRunner(provider=self.provider, max_iterations=payload.get("max_iterations", 0))
            result = await runner.run(
                system_prompt=ONBOARDING_SYSTEM_PROMPT,
                user_prompt=json.dumps(
                    {
                        "customer_id": context.customer_id,
                        "repo_url": repo_url,
                        "scan_context": scan_ctx,
                        "provided_context": provided_context,
                    },
                    indent=2,
                    default=str,
                ),
                final_schema=OnboardingReport,
            )
            report = OnboardingReport.model_validate(result["final"])
            model_used = result.get("model")
            scanned = scan_result.data
            report.evidence = [
                f"Scanned {scanned.get('file_count', 0)} files; read contents of "
                f"{len(scanned.get('file_contents', {}))} high-signal files: "
                + ", ".join(list(scanned.get("file_contents", {}).keys())[:10]),
            ]

        report.source_repo_url = repo_url

        repo_result = await self.context_repo.generate(context.customer_id, report)
        report.artifact_path = repo_result.get("local_path")
        report.context_repo_url = repo_result.get("context_repo_url")
        report.context_repo_full_name = repo_result.get("context_repo_full_name")
        report.warnings = [*report.warnings, *repo_result.get("warnings", [])]

        # Seed core memory (always-in-context facts) + an episode for recall.
        memory.store(context.customer_id, "core", f"System {report.repo_name}: {report.architecture_summary[:280]}", importance=9)
        if report.services:
            memory.store(context.customer_id, "core", f"Services: {', '.join(report.services[:12])}", importance=8)
        for risk in report.risks[:3]:
            memory.store(context.customer_id, "core", f"Risk: {risk}", importance=7)
        memory.store(context.customer_id, "episode", f"Onboarded {report.repo_name} from {repo_url}.", importance=5)

        data = {
            "report": report.model_dump(),
            "context_repo": repo_result,
            "model": model_used,
        }
        put_cached(context.customer_id, repo_url, chash, data)

        return AgentResult(
            success=True,
            summary="Repository onboarding completed" + (" (cached analysis)" if golden is not None else ""),
            data={**data, "cached": golden is not None},
            warnings=report.warnings,
        )
