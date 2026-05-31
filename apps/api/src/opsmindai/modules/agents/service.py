from __future__ import annotations

import asyncio

from opsmindai.agents.base.schemas import ExecutionContext
from opsmindai.agents.onboarding.agent import OnboardingAgent
from opsmindai.agents.rca.agent import RCAAgent
from opsmindai.agents.release.agent import ReleaseAgent
from opsmindai.modules.runs.repository import create_run, update_run

AGENT_REGISTRY = {
    "onboarding": OnboardingAgent,
    "rca": RCAAgent,
    "release": ReleaseAgent,
}


async def execute_agent(
    agent_name: str,
    *,
    customer_id: str,
    payload: dict,
    trace_id: str,
    provider: str | None = None,
):
    agent_class = AGENT_REGISTRY.get(agent_name)
    if agent_class is None:
        raise KeyError(f"Unknown agent: {agent_name}")

    agent = agent_class(provider=provider)
    run = create_run(
        trace_id=trace_id,
        customer_id=customer_id,
        agent_name=agent_name,
        provider=provider or "default",
        input_json=payload,
    )

    context = ExecutionContext(
        trace_id=trace_id,
        customer_id=customer_id,
        agent_run_id=run.run_id,
    )

    try:
        # Bound the run so a throttled provider fails gracefully instead of
        # spinning forever (the free tier can stall LLM calls under load).
        result = await asyncio.wait_for(agent.run(context, payload), timeout=120)
        update_run(
            run.run_id,
            status="completed",
            output_json=result.model_dump(),
            debug_json={"warnings": result.warnings},
        )
        return {
            "run": update_run(run.run_id, status="completed", output_json=result.model_dump()).model_dump(),
            "result": result.model_dump(),
        }
    except asyncio.TimeoutError:
        update_run(run.run_id, status="failed", error_json={"error": "timeout"})
        raise RuntimeError("The model is busy (free-tier rate limit). Please try again in a moment.")
    except Exception as exc:
        update_run(
            run.run_id,
            status="failed",
            error_json={"error": str(exc)},
        )
        raise
