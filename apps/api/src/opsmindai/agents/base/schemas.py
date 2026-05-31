from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExecutionContext(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    trace_id: str
    customer_id: str
    agent_run_id: str
    iteration: int = 0
    max_iterations: int = 10
    # Optional async event sink for live streaming (chat). Agents call
    # `await ctx.send(type, **data)` to emit thinking/tool events as they work.
    emit: Any = None

    async def send(self, event_type: str, **data: Any) -> None:
        if self.emit is not None:
            await self.emit(event_type, data)


class AgentResult(BaseModel):
    success: bool
    summary: str
    data: dict = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
