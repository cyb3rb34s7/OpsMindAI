from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool

# Service names match the Online Boutique (GoogleCloudPlatform/microservices-demo)
# so the onboarded system and the incident under investigation are the same.
DEMO_LOGS = [
    {
        "trace_id": "trace_123",
        "ts": "10:41:58",
        "service": "frontend",
        "level": "info",
        "message": "placeOrder request received for user session",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:02",
        "service": "checkoutservice",
        "level": "info",
        "message": "fetching user cart from cartservice",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:08",
        "service": "cartservice",
        "level": "error",
        "message": "redis connection dropped during cart lookup (dial tcp redis-cart:6379: connect: connection refused)",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:10",
        "service": "checkoutservice",
        "level": "error",
        "message": "cart retrieval failed, aborting checkout: rpc error code = Unavailable",
    },
    {
        "trace_id": "trace_123",
        "ts": "10:42:12",
        "service": "paymentservice",
        "level": "warn",
        "message": "no charge attempted — upstream checkout aborted",
    },
    {
        "trace_id": "trace_456",
        "ts": "11:05:33",
        "service": "productcatalogservice",
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
