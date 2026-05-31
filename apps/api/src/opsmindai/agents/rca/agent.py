from __future__ import annotations

import json
from pathlib import Path

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.prompts import RCA_SYSTEM_PROMPT
from opsmindai.agents.rca.analyzer import build_rca_context
from opsmindai.agents.rca.report_generator import RCAReportWriter
from opsmindai.agents.rca.schemas import RCAReport
from opsmindai.agents.rca.skill_extractor import extract_skill
from opsmindai.modules.memory.service import memory
from opsmindai.modules.skills.repository import find_relevant_skills, save_skill
from opsmindai.runtime.runner import CognitiveRunner
from opsmindai.tools.logs.tool import FetchLogsTool
from opsmindai.tools.traces.tool import CorrelateTraceTool


class RCAAgent(BaseAgent):
    name = "rca"

    def __init__(self, provider: str | None = None):
        super().__init__()
        self.provider = provider
        self.log_tool = FetchLogsTool()
        self.trace_tool = CorrelateTraceTool()
        self.report_writer = RCAReportWriter()

    async def execute(self, context: ExecutionContext, payload: dict) -> AgentResult:
        customer_context = Path("storage/context_repos") / context.customer_id
        if not customer_context.exists():
            return AgentResult(
                success=False,
                summary="Missing onboarding context",
                data={},
                warnings=["Run onboarding first or provide manual context."],
            )

        trace_id = payload.get("trace_id")
        if not trace_id:
            return AgentResult(
                success=False,
                summary="trace_id is required",
                data={},
                warnings=["trace_id missing"],
            )

        logs_result = await self.log_tool.execute({"trace_id": trace_id})
        if not logs_result.success:
            return AgentResult(
                success=False,
                summary="Log fetch failed",
                data=logs_result.data,
                warnings=[logs_result.error or "log fetch failed"],
            )

        trace_result = await self.trace_tool.execute(
            {"logs": logs_result.data["logs"]}
        )
        if not trace_result.success:
            return AgentResult(
                success=False,
                summary="Trace correlation failed",
                data=trace_result.data,
                warnings=[trace_result.error or "trace correlation failed"],
            )

        # Self-improving loop: pull prior skills this customer has accumulated
        # for similar incidents and feed them into the agent's context.
        incident_text = " ".join(
            str(payload.get(k, ""))
            for k in ("description", "title", "summary", "trace_id")
        )
        logs_text = json.dumps(logs_result.data, default=str)
        relevant_skills = find_relevant_skills(
            context.customer_id, f"{incident_text} {logs_text}"
        )

        runner = CognitiveRunner(
            provider=self.provider,
            max_iterations=payload.get("max_iterations", 4),
        )
        result = await runner.run(
            system_prompt=RCA_SYSTEM_PROMPT,
            user_prompt=json.dumps(
                {
                    "incident": payload,
                    "logs": logs_result.data,
                    "trace_flow": trace_result.data,
                    "context_path": str(customer_context),
                    "learned_skills": [
                        {
                            "failure_pattern": s["failure_pattern"],
                            "resolution": s["resolution"],
                            "times_seen": s["success_count"],
                        }
                        for s in relevant_skills
                    ],
                },
                indent=2,
                default=str,
            ),
            final_schema=RCAReport,
        )

        report = RCAReport.model_validate(result["final"])
        report.evidence = [
            json.dumps(logs_result.data, default=str),
            json.dumps(trace_result.data, default=str),
            *[json.dumps(item, default=str) for item in result["tool_results"]],
        ]
        report.applied_skills = [
            f"{s['failure_pattern']} (seen {s['success_count']}x)"
            for s in relevant_skills
        ]
        report.artifact_path = self.report_writer.generate(
            payload.get("incident_id", "incident"),
            report,
        )

        # Persist what we learned so the next similar incident is faster/smarter.
        skill_data = extract_skill(report)
        saved_skill = save_skill(
            customer_id=context.customer_id,
            agent_name=self.name,
            failure_pattern=skill_data["failure_pattern"],
            resolution=skill_data["resolution"],
            confidence=skill_data["success_score"],
        )

        # Episodic memory: a recallable record of this incident across sessions.
        incident_id = payload.get("incident_id", "incident")
        fix = report.recommendations[0] if report.recommendations else "investigated"
        memory.store(
            context.customer_id,
            "episode",
            f"Incident {incident_id} ({trace_id}): {report.root_cause}. "
            f"Impacted: {', '.join(report.impacted_services[:5])}. Fix: {fix}",
            importance=8 if report.confidence >= 0.7 else 6,
        )

        return AgentResult(
            success=True,
            summary="RCA workflow completed",
            data={
                "report": report.model_dump(),
                "applied_skills": relevant_skills,
                "learned_skill": saved_skill,
                "execution": result,
            },
            warnings=report.warnings,
        )
