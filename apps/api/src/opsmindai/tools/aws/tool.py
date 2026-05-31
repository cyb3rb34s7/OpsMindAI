from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool


class ValidateAwsConfigTool(BaseTool):
    name = "validate_aws_config"

    async def execute(self, payload: dict) -> ToolResult:
        mode = payload.get("demo_mode")
        if mode is None:
            return ToolResult(success=False, error="demo_mode is required")

        if mode == "blocked":
            return ToolResult(
                success=True,
                data={
                    "valid": False,
                    "findings": ["Security group allows public database access"],
                },
            )

        if mode == "healthy":
            return ToolResult(success=True, data={"valid": True, "findings": []})

        return ToolResult(success=False, error=f"Unknown demo_mode: {mode}")
