from fastapi import APIRouter

from opsmindai.modules.runs.repository import find_runs_by_trace_id, get_run, list_runs
from opsmindai.shared.responses import success_response

router = APIRouter(prefix="/api/v1", tags=["runs"])


@router.get("/runs")
async def runs(limit: int = 50):
    return success_response({"items": [r.model_dump() for r in list_runs(limit=limit)]})


@router.get("/runs/{run_id}")
async def run_detail(run_id: str):
    return success_response(get_run(run_id).model_dump())


@router.get("/traces/{trace_id}")
async def trace_detail(trace_id: str):
    return success_response(
        {
            "trace_id": trace_id,
            "runs": [r.model_dump() for r in find_runs_by_trace_id(trace_id)],
        }
    )
