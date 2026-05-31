from pydantic import BaseModel, Field


class ToolResult(BaseModel):
    success: bool
    data: dict = Field(default_factory=dict)
    error: str | None = None
