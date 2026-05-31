from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool


class RunSanityChecksTool(BaseTool):
    name = "run_sanity_checks"

    async def execute(self, payload: dict) -> ToolResult:
        mode = payload.get("demo_mode")
        if mode is None:
            return ToolResult(success=False, error="demo_mode is required")

        if mode == "blocked":
            return ToolResult(
                success=True,
                data={
                    "checks": [
                        "API health endpoint reachable",
                        "Redis connectivity failed",
                        "Database connectivity healthy",
                    ]
                },
            )

        return ToolResult(
            success=True,
            data={
                "checks": [
                    "API health endpoint reachable",
                    "Redis connectivity successful",
                    "Database connectivity healthy",
                ]
            },
        )
