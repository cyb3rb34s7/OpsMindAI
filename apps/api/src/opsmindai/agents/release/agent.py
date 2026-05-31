from __future__ import annotations

import json

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.prompts import RELEASE_SYSTEM_PROMPT
from opsmindai.agents.release.analyzer import build_release_context
from opsmindai.agents.release.report_generator import ReleaseReportWriter
from opsmindai.agents.release.schemas import ReleaseReport
from opsmindai.runtime.runner import CognitiveRunner
from opsmindai.tools.aws.tool import ValidateAwsConfigTool
from opsmindai.tools.jenkins.tool import TriggerDeploymentTool
from opsmindai.tools.sanity.tool import RunSanityChecksTool
from opsmindai.tools.startup.tool import MonitorStartupTool


class ReleaseAgent(BaseAgent):
    name = "release"

    def __init__(self, provider: str | None = None):
        super().__init__()
        self.provider = provider
        self.aws_tool = ValidateAwsConfigTool()
        self.jenkins_tool = TriggerDeploymentTool()
        self.startup_tool = MonitorStartupTool()
        self.sanity_tool = RunSanityChecksTool()
        self.report_writer = ReleaseReportWriter()

    async def execute(self, context: ExecutionContext, payload: dict) -> AgentResult:
        runner = CognitiveRunner(
            provider=self.provider,
            max_iterations=payload.get("max_iterations", 4),
        )

        # 'healthy' by default; pass demo_mode='blocked' to exercise the
        # intentional AWS misconfiguration / failed-sanity scenario.
        demo_mode = payload.get("demo_mode", "healthy")

        aws_validation = await self.aws_tool.execute({"demo_mode": demo_mode})
        if not aws_validation.success:
            return AgentResult(
                success=False,
                summary="AWS validation failed",
                data=aws_validation.data,
                warnings=[aws_validation.error or "AWS validation failed"],
            )

        startup_result = await self.startup_tool.execute({"demo_mode": demo_mode})
        sanity_result = await self.sanity_tool.execute({"demo_mode": demo_mode})

        final = await runner.run(
            system_prompt=RELEASE_SYSTEM_PROMPT,
            user_prompt=json.dumps(
                {
                    "release_request": payload,
                    "aws_validation": aws_validation.data,
                    "startup_result": startup_result.data,
                    "sanity_results": sanity_result.data,
                },
                indent=2,
                default=str,
            ),
            final_schema=ReleaseReport,
        )

        report = ReleaseReport.model_validate(final["final"])
        report.evidence = [
            json.dumps(aws_validation.data, default=str),
            json.dumps(startup_result.data, default=str),
            json.dumps(sanity_result.data, default=str),
            *[json.dumps(item, default=str) for item in final["tool_results"]],
        ]

        if report.deployment_status == "successful":
            deployment = await self.jenkins_tool.execute(payload)
            report.evidence.append(json.dumps(deployment.data, default=str))
            report.artifact_path = self.report_writer.generate(
                deployment.data["deployment_id"],
                report,
            )
        else:
            report.artifact_path = self.report_writer.generate("blocked_release", report)

        report_context = build_release_context(
            aws_validation.data,
            startup_result.data,
            sanity_result.data.get("checks", []),
        )

        return AgentResult(
            success=True,
            summary="Release workflow completed",
            data={
                "report": report.model_dump(),
                "context": report_context,
                "execution": final,
            },
            warnings=report.warnings,
        )
