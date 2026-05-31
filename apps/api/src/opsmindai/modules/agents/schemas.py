from pydantic import BaseModel, Field


class AgentRunRequest(BaseModel):
    customer_id: str
    payload: dict = Field(default_factory=dict)
    provider: str | None = None
