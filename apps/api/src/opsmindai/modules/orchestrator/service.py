from __future__ import annotations

from opsmindai.agents.base.schemas import ExecutionContext
from opsmindai.agents.orchestrator.agent import OrchestratorAgent
from opsmindai.modules.agents.service import execute_agent


async def run_orchestrator(
    *,
    customer_id: str,
    message: str,
    payload: dict,
    trace_id: str,
    provider: str | None = None,
):
    orchestrator = OrchestratorAgent(provider=provider)
    route_result = await orchestrator.run(
        context=ExecutionContext(
            trace_id=trace_id,
            customer_id=customer_id,
            agent_run_id=f"orchestrator_{trace_id}",
            max_iterations=1,
        ),
        payload={"message": message, **payload},
    )
    intent = route_result.data.get("intent", "rca")
    agent_result = await execute_agent(
        intent,
        customer_id=customer_id,
        payload=payload,
        trace_id=trace_id,
        provider=provider,
    )
    return {"route": route_result.model_dump(), "agent": agent_result}
