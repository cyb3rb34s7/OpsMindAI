from __future__ import annotations

import json

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import AgentResult, ExecutionContext
from opsmindai.agents.cognition.schemas import RouteDecision
from opsmindai.agents.prompts import ORCHESTRATOR_SYSTEM_PROMPT
from opsmindai.shared.llm.base.models import LLMRequest
from opsmindai.shared.llm.client import LLMClient


class OrchestratorAgent(BaseAgent):
    name = "orchestrator"

    def __init__(self, provider: str | None = None):
        super().__init__()
        self.client = LLMClient(provider=provider)

    async def execute(self, context: ExecutionContext, payload: dict) -> AgentResult:
        message = payload.get("message")
        if not message:
            return AgentResult(
                success=False,
                summary="message is required",
                data={},
                warnings=["message missing"],
            )

        request = LLMRequest(
            system_prompt=ORCHESTRATOR_SYSTEM_PROMPT,
            user_prompt=json.dumps(
                {
                    "message": message,
                    "payload": payload,
                    "customer_id": context.customer_id,
                },
                indent=2,
                default=str,
            ),
            response_schema=RouteDecision,
        )
        response = await self.client.generate(request)
        if response.structured_output is None:
            raise RuntimeError("Route decision was not structured")

        decision = RouteDecision.model_validate(response.structured_output)
        return AgentResult(
            success=True,
            summary="Intent classified",
            data=decision.model_dump(),
            warnings=[],
        )
