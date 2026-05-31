from fastapi import APIRouter

from opsmindai.modules.orchestrator.schemas import OrchestratorRunRequest
from opsmindai.modules.orchestrator.service import run_orchestrator
from opsmindai.shared.responses import success_response
from opsmindai.shared.trace import generate_trace_id

router = APIRouter(prefix="/api/v1", tags=["orchestrator"])


@router.post("/orchestrator/run")
async def orchestrator_run(request: OrchestratorRunRequest):
    trace_id = generate_trace_id()
    result = await run_orchestrator(
        customer_id=request.customer_id,
        message=request.message,
        payload=request.payload,
        trace_id=trace_id,
        provider=request.provider,
    )
    return success_response(result)
