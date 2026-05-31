from opsmindai.tools.logs.tool import FetchLogsTool


async def fetch_logs(trace_id: str | None):
    if trace_id is None:
        return []
    result = await FetchLogsTool().execute({"trace_id": trace_id})
    return result.data.get("logs", []) if result.success else []
