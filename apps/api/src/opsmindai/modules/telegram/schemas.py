from pydantic import BaseModel, Field


class TelegramWebhookRequest(BaseModel):
    customer_id: str
    message: str
    payload: dict = Field(default_factory=dict)
    provider: str | None = None
