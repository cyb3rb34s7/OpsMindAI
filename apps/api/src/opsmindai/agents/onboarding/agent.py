from __future__ import annotations

import json

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.onboarding.analyzer import build_onboarding_context
from opsmindai.agents.onboarding.context_repo import ContextRepoGenerator
from opsmindai.agents.onboarding.schemas import OnboardingReport
from opsmindai.agents.prompts import ONBOARDING_SYSTEM_PROMPT
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

        # Additional human-provided context sources beyond the code itself.
        # Empty strings are fine — the agent simply has less to work with.
        provided_context = {
            "decision_records": payload.get("decisions", ""),
            "transcripts": payload.get("transcripts", ""),
            "business_context": payload.get("business_context", ""),
            "extra_docs": payload.get("extra_docs", ""),
        }

        # Onboarding cognition is synthesis over an already-fetched scan, so it
        # needs few iterations; extra loops just re-call the scan tool and waste
        # GitHub calls + LLM round-trips.
        runner = CognitiveRunner(
            provider=self.provider,
            max_iterations=payload.get("max_iterations", 2),
        )
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
        report.source_repo_url = repo_url
        report.evidence = [
            json.dumps(scan_result.data, default=str),
            *[json.dumps(item, default=str) for item in result["tool_results"]],
        ]

        repo_result = await self.context_repo.generate(context.customer_id, report)
        report.artifact_path = repo_result.get("local_path")
        report.context_repo_url = repo_result.get("context_repo_url")
        report.context_repo_full_name = repo_result.get("context_repo_full_name")
        report.warnings = [*report.warnings, *repo_result.get("warnings", [])]

        return AgentResult(
            success=True,
            summary="Repository onboarding completed",
            data={
                "report": report.model_dump(),
                "context_repo": repo_result,
                "execution": result,
            },
            warnings=report.warnings,
        )
