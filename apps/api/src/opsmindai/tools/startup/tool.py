from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool


class MonitorStartupTool(BaseTool):
    name = "monitor_startup"

    async def execute(self, payload: dict) -> ToolResult:
        mode = payload.get("demo_mode")
        if mode is None:
            return ToolResult(success=False, error="demo_mode is required")

        if mode == "blocked":
            return ToolResult(
                success=True,
                data={
                    "status": "degraded",
                    "latency_ms": 910,
                    "warnings": ["Startup timed out"],
                },
            )

        return ToolResult(
            success=True,
            data={
                "status": "healthy",
                "latency_ms": 420,
                "warnings": ["Startup latency elevated"],
            },
        )
