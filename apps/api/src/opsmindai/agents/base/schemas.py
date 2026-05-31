from pydantic import BaseModel, Field


class ExecutionContext(BaseModel):
    trace_id: str
    customer_id: str
    agent_run_id: str
    iteration: int = 0
    max_iterations: int = 10


class AgentResult(BaseModel):
    success: bool
    summary: str
    data: dict = Field(default_factory=dict)
    warnings: list[str] = Field(default_factory=list)
