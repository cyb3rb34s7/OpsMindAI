from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class LLMRequest(BaseModel):
    system_prompt: str
    user_prompt: str
    temperature: float = 0.2
    max_tokens: int = 2000
    response_schema: type[BaseModel] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(arbitrary_types_allowed=True)


class LLMResponse(BaseModel):
    content: str
    structured_output: dict[str, Any] | None = None
    provider: str
    model: str
    latency_ms: int
    tokens_used: int
    finish_reason: str
