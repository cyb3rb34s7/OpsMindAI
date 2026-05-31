from uuid import uuid4

from opsmindai.tools.base.schemas import ToolResult
from opsmindai.tools.base.tool import BaseTool


class TriggerDeploymentTool(BaseTool):
    name = "trigger_deployment"

    async def execute(self, payload: dict) -> ToolResult:
        return ToolResult(
            success=True,
            data={
                "deployment_id": f"deploy_{uuid4().hex[:8]}",
                "status": "triggered",
            },
        )
