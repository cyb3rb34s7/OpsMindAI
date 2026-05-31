from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from opsmindai.modules.chat.runtime import clear_task, is_busy, lock_for, register_task, stop
from opsmindai.modules.chat.schemas import ChatRequest, ChatStopRequest
from opsmindai.modules.chat.service import run_turn
from opsmindai.shared.responses import success_response

router = APIRouter(prefix="/api/v1", tags=["chat"])


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


@router.post("/chat")
async def chat(req: ChatRequest):
    customer_id, thread_id, message = req.customer_id, req.thread_id, req.message

    async def event_stream():
        queue: asyncio.Queue = asyncio.Queue()

        async def emit(event_type: str, data: dict) -> None:
            await queue.put({"type": event_type, **data})

        # If a turn is already running for this thread, this one is queued: it
        # awaits the lock and starts streaming once the current turn finishes.
        if is_busy(customer_id, thread_id):
            yield _sse({"type": "queued"})

        async def worker():
            async with lock_for(customer_id, thread_id):
                # Register only after acquiring the lock, so stop() cancels the
                # ACTIVE turn, never a queued one.
                register_task(customer_id, thread_id, asyncio.current_task())
                try:
                    # Bound the turn so a throttled provider never hangs the UI.
                    await asyncio.wait_for(
                        run_turn(customer_id, thread_id, message, emit, provider=req.provider),
                        timeout=240,
                    )
                    await queue.put({"type": "done"})
                except asyncio.TimeoutError:
                    await queue.put({"type": "error", "message": "The model is busy (free-tier rate limit). Please try again in a moment."})
                except asyncio.CancelledError:
                    await queue.put({"type": "cancelled"})
                    raise
                except Exception as exc:  # surface, never hang the stream
                    await queue.put({"type": "error", "message": str(exc)})
                finally:
                    clear_task(customer_id, thread_id)
                    await queue.put(None)  # sentinel

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


@router.post("/chat/stop")
async def chat_stop(req: ChatStopRequest):
    cancelled = stop(req.customer_id, req.thread_id)
    return success_response({"cancelled": cancelled})
