"""Stream any agent's live events (thinking/tool/result) over SSE — used by the
consoles that want to watch an agent work, not just get the final result."""
from __future__ import annotations

import asyncio
import json

from fastapi.responses import StreamingResponse

from opsmindai.agents.base.agent import BaseAgent
from opsmindai.agents.base.schemas import ExecutionContext
from opsmindai.shared.trace import generate_trace_id


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


def stream_agent_sse(agent: BaseAgent, customer_id: str, payload: dict) -> StreamingResponse:
    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()

        async def emit(event_type: str, data: dict) -> None:
            await queue.put({"type": event_type, **data})

        async def worker():
            try:
                ctx = ExecutionContext(
                    trace_id=generate_trace_id(),
                    customer_id=customer_id,
                    agent_run_id=f"stream_{generate_trace_id()}",
                    emit=emit,
                )
                result = await asyncio.wait_for(agent.run(ctx, payload), timeout=180)
                await queue.put({"type": "result", "data": result.data})
                await queue.put({"type": "done"})
            except asyncio.CancelledError:
                await queue.put({"type": "cancelled"})
                raise
            except Exception as exc:
                await queue.put({"type": "error", "message": str(exc)})
            finally:
                await queue.put(None)

        task = asyncio.create_task(worker())
        try:
            while True:
                ev = await queue.get()
                if ev is None:
                    break
                yield _sse(ev)
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )
