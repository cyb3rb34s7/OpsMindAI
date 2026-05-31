from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool

DEMO_LOGS = [
    {
        "trace_id": "trace_123",
        "ts": "10:41:58",
        "service": "auth-service",
        "level": "info",
        "message": "token validated successfully",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:02",
        "service": "cache-service",
        "level": "warn",
        "message": "cache latency increased after deploy",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:08",
        "service": "payment-service",
        "level": "error",
        "message": "redis connection dropped during session lookup",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:10",
        "service": "checkout-service",
        "level": "error",
        "message": "payment retry loop exhausted",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:12",
        "service": "api-gateway",
        "level": "info",
        "message": "request trace propagated to downstream services",
    },
    {
        "trace_id": "trace_456",
        "ts": "11:05:33",
        "service": "orders-service",
        "level": "error",
        "message": "db pool exhaustion detected during burst traffic",
    },
]


class FetchLogsTool(BaseTool):
    name = "fetch_logs"

    async def execute(self, payload: dict) -> ToolResult:
        trace_id = payload.get("trace_id")
        if not trace_id:
            return ToolResult(success=False, error="trace_id is required")

        logs = [log for log in DEMO_LOGS if log["trace_id"] == trace_id]
        return ToolResult(success=True, data={"trace_id": trace_id, "logs": logs})
