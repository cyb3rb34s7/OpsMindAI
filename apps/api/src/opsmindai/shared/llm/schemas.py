from pydantic import BaseModel


class LLMResponse(BaseModel):
    content: str
    provider: str
    model: str
    tokens_used: int