from fastapi import FastAPI, Request

from opsmindai.modules.agents.router import router as agents_router
from opsmindai.modules.orchestrator.router import router as orchestrator_router
from opsmindai.modules.context.router import router as context_router
from opsmindai.modules.runs.router import router as runs_router
from opsmindai.modules.skills.router import router as skills_router
from opsmindai.modules.telegram.router import router as telegram_router
from opsmindai.shared.db import init_db
from opsmindai.shared.errors import OpsMindError, opsmind_exception_handler
from opsmindai.shared.logging import logger
from opsmindai.shared.responses import success_response
from opsmindai.shared.trace import generate_trace_id, set_trace_id
from opsmindai.tools.registry import register_default_tools

app = FastAPI(title="OpsMindAI")


@app.on_event("startup")
async def startup_event():
    init_db()
    register_default_tools()


@app.middleware("http")
async def trace_middleware(request: Request, call_next):
    trace_id = request.headers.get("X-Trace-Id") or generate_trace_id()
    set_trace_id(trace_id)

    logger.info(
        "request.started",
        extra={
            "event": "request.started",
            "path": request.url.path,
            "method": request.method,
            "trace_id": trace_id,
        },
    )

    response = await call_next(request)
    response.headers["X-Trace-Id"] = trace_id

    logger.info(
        "request.completed",
        extra={
            "event": "request.completed",
            "status_code": response.status_code,
            "trace_id": trace_id,
        },
    )
    return response


app.add_exception_handler(OpsMindError, opsmind_exception_handler)
app.include_router(orchestrator_router)
app.include_router(agents_router)
app.include_router(runs_router)
app.include_router(skills_router)
app.include_router(context_router)
app.include_router(telegram_router)


@app.get("/health")
async def health():
    return success_response({"status": "ok"})
