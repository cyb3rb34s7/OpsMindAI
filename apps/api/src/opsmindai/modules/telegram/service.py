from opsmindai.modules.orchestrator.service import run_orchestrator


async def process_telegram_message(
    *,
    customer_id: str,
    message: str,
    payload: dict,
    trace_id: str,
    provider: str | None = None,
):
    return await run_orchestrator(
        customer_id=customer_id,
        message=message,
        payload=payload,
        trace_id=trace_id,
        provider=provider,
    )
