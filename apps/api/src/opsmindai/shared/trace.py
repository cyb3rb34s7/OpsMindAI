from contextvars import ContextVar
from uuid import uuid4

trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="")


def generate_trace_id() -> str:
    return f"tr_{uuid4().hex}"


def set_trace_id(trace_id: str) -> None:
    trace_id_ctx.set(trace_id)


def get_trace_id() -> str:
    return trace_id_ctx.get()
