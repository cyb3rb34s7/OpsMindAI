from opsmindai.tools.traces.tool import CorrelateTraceTool


async def correlate_trace(logs: list[dict]) -> list[str]:
    result = await CorrelateTraceTool().execute({"logs": logs})
    return result.data.get("trace_flow", []) if result.success else []
