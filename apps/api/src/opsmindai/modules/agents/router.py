from fastapi import APIRouter, HTTPException

from opsmindai.agents.release.agent import ReleaseAgent
from opsmindai.modules.agents.schemas import AgentRunRequest
from opsmindai.modules.agents.service import execute_agent
from opsmindai.modules.agents.stream import stream_agent_sse
from opsmindai.shared.responses import success_response
from opsmindai.shared.trace import generate_trace_id

router = APIRouter(prefix="/api/v1", tags=["agents"])


@router.post("/agents/release/stream")
async def release_stream(request: AgentRunRequest):
    """Stream the release rollout (pre-deploy → per-region deploy/startup/sanity)."""
    return stream_agent_sse(ReleaseAgent(provider=request.provider), request.customer_id, request.payload)


@router.post("/agents/{agent_name}")
async def agent_execute(agent_name: str, request: AgentRunRequest):
    trace_id = generate_trace_id()
    try:
        result = await execute_agent(
            agent_name,
            customer_id=request.customer_id,
            payload=request.payload,
            trace_id=trace_id,
            provider=request.provider,
        )
        return success_response(result)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
