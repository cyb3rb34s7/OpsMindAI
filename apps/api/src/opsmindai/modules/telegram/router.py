from fastapi import APIRouter, HTTPException

from opsmindai.modules.memory.service import memory
from opsmindai.modules.telegram import gateway
from opsmindai.modules.telegram.schemas import (
    TelegramConnectRequest,
    TelegramDisconnectRequest,
    TelegramWebhookRequest,
)
from opsmindai.modules.telegram.service import process_telegram_message
from opsmindai.shared.responses import success_response
from opsmindai.shared.trace import generate_trace_id

router = APIRouter(prefix="/api/v1/telegram", tags=["telegram"])


@router.post("/connect")
async def telegram_connect(request: TelegramConnectRequest):
    """Connect the tenant's bot: validate the token, persist, start polling."""
    try:
        result = await gateway.connect(request.customer_id, request.token, request.name)
    except gateway.TelegramAPIError as exc:
        raise HTTPException(status_code=400, detail=f"Telegram rejected the token: {exc}") from exc
    return success_response(result)


@router.post("/disconnect")
async def telegram_disconnect(request: TelegramDisconnectRequest):
    return success_response(await gateway.disconnect(request.customer_id))


@router.get("/status/{customer_id}")
async def telegram_status(customer_id: str):
    return success_response(gateway.status(customer_id))


@router.get("/sessions/{customer_id}")
async def telegram_sessions(customer_id: str):
    """Live mirror of the bot's chats — each maps to a `tg-<chat_id>` thread in the
    shared memory store, so the dashboard sees exactly what the bot is doing."""
    return success_response({"sessions": memory.threads(customer_id, "tg-")})


@router.get("/sessions/{customer_id}/{thread_id}")
async def telegram_session_history(customer_id: str, thread_id: str):
    return success_response({"turns": memory.conversation_history(customer_id, thread_id)})


@router.post("/webhook")
async def telegram_webhook(request: TelegramWebhookRequest):
    trace_id = generate_trace_id()
    result = await process_telegram_message(
        customer_id=request.customer_id,
        message=request.message,
        payload=request.payload,
        trace_id=trace_id,
        provider=request.provider,
    )
    return success_response(result)
