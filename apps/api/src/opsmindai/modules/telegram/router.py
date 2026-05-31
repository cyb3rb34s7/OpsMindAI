from fastapi import APIRouter

from opsmindai.modules.telegram.schemas import TelegramWebhookRequest
from opsmindai.modules.telegram.service import process_telegram_message
from opsmindai.shared.responses import success_response
from opsmindai.shared.trace import generate_trace_id

router = APIRouter(prefix="/api/v1/telegram", tags=["telegram"])


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
